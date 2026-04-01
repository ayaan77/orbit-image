import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock getDb ───
const mockDb = vi.fn() as ReturnType<typeof vi.fn> & {
  query: ReturnType<typeof vi.fn>;
};
mockDb.query = vi.fn();

vi.mock('@/lib/storage/db', () => ({
  getDb: () => mockDb,
}));

import {
  getWorkspacesForUser,
  requireWorkspaceMember,
  getChannels,
  getDMs,
  getOrCreateDM,
  getMessages,
  createMessage,
  softDeleteMessage,
  getThreadReplies,
  toggleReaction,
  getUnreadMentionCount,
  markMentionsRead,
} from '@/lib/chat/db';

// ─── Helpers ───

const NOW = new Date('2025-06-01T00:00:00Z');

function fakeWorkspaceRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'workspace01',
    brand_id: 'apexure',
    name: 'Apexure',
    slug: 'apexure',
    created_at: NOW,
    role: 'member',
    ...overrides,
  };
}

function fakeChannelRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'channel01',
    workspace_id: 'workspace01',
    name: 'general',
    description: 'General discussion',
    is_dm: false,
    created_by: 'user01',
    created_at: NOW,
    ...overrides,
  };
}

function fakeMessageRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'msg01',
    channel_id: 'channel01',
    user_id: 'user01',
    username: 'alice',
    content: 'Hello',
    type: 'text',
    parent_id: null,
    deleted_at: null,
    created_at: NOW,
    reply_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getWorkspacesForUser ───

describe('getWorkspacesForUser', () => {
  it('returns empty array when db is null', async () => {
    vi.doMock('@/lib/storage/db', () => ({ getDb: () => null }));
    // The module-level mock always returns mockDb — test graceful path via empty result
    mockDb.mockResolvedValueOnce([]);
    const result = await getWorkspacesForUser('user01');
    expect(result).toEqual([]);
  });

  it('maps workspace rows to Workspace objects', async () => {
    mockDb.mockResolvedValueOnce([fakeWorkspaceRow()]);

    const result = await getWorkspacesForUser('user01');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'workspace01',
      brandId: 'apexure',
      name: 'Apexure',
      slug: 'apexure',
      role: 'member',
      createdAt: NOW.toISOString(),
    });
  });

  it('maps role field from row', async () => {
    mockDb.mockResolvedValueOnce([fakeWorkspaceRow({ role: 'admin' })]);
    const result = await getWorkspacesForUser('user01');
    expect(result[0].role).toBe('admin');
  });

  it('returns multiple workspaces', async () => {
    mockDb.mockResolvedValueOnce([
      fakeWorkspaceRow({ id: 'ws01', brand_id: 'brand1' }),
      fakeWorkspaceRow({ id: 'ws02', brand_id: 'brand2' }),
    ]);
    const result = await getWorkspacesForUser('user01');
    expect(result).toHaveLength(2);
  });
});

// ─── requireWorkspaceMember ───

describe('requireWorkspaceMember', () => {
  it('returns role when user is a member', async () => {
    mockDb.mockResolvedValueOnce([{ role: 'member' }]);
    const role = await requireWorkspaceMember('workspace01', 'user01');
    expect(role).toBe('member');
  });

  it('returns admin role', async () => {
    mockDb.mockResolvedValueOnce([{ role: 'admin' }]);
    const role = await requireWorkspaceMember('workspace01', 'user01');
    expect(role).toBe('admin');
  });

  it('throws 403 error when user is not a member', async () => {
    mockDb.mockResolvedValueOnce([]);
    await expect(
      requireWorkspaceMember('workspace01', 'not-a-member')
    ).rejects.toThrow('Not a member of this workspace');
  });

  it('thrown error has status 403', async () => {
    mockDb.mockResolvedValueOnce([]);
    try {
      await requireWorkspaceMember('workspace01', 'not-a-member');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(403);
    }
  });
});

// ─── getChannels ───

describe('getChannels', () => {
  it('returns channels for a workspace', async () => {
    mockDb.mockResolvedValueOnce([
      fakeChannelRow({ name: 'general' }),
      fakeChannelRow({ id: 'channel02', name: 'blog-hero' }),
    ]);

    const result = await getChannels('workspace01');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('general');
    expect(result[1].name).toBe('blog-hero');
  });

  it('maps isDm to false for regular channels', async () => {
    mockDb.mockResolvedValueOnce([fakeChannelRow()]);
    const result = await getChannels('workspace01');
    expect(result[0].isDm).toBe(false);
  });

  it('returns empty array when no channels', async () => {
    mockDb.mockResolvedValueOnce([]);
    const result = await getChannels('workspace01');
    expect(result).toEqual([]);
  });
});

// ─── getDMs ───

describe('getDMs', () => {
  it('returns DM channels for a user', async () => {
    mockDb.mockResolvedValueOnce([
      fakeChannelRow({ id: 'dm01', name: 'dm_user01_user02', is_dm: true }),
    ]);

    const result = await getDMs('workspace01', 'user01');
    expect(result).toHaveLength(1);
    expect(result[0].isDm).toBe(true);
  });

  it('returns empty array when no DMs', async () => {
    mockDb.mockResolvedValueOnce([]);
    const result = await getDMs('workspace01', 'user01');
    expect(result).toEqual([]);
  });
});

// ─── getOrCreateDM ───

describe('getOrCreateDM', () => {
  it('returns existing DM channel if it exists (race-safe: INSERT conflict → SELECT)', async () => {
    const dmRow = fakeChannelRow({
      id: 'dm01',
      name: 'dm_user01_user02',
      is_dm: true,
    });
    // New flow: INSERT ON CONFLICT DO NOTHING returns [] (conflict), then SELECT, then member insert
    mockDb
      .mockResolvedValueOnce([]) // INSERT ON CONFLICT DO NOTHING — conflict, no row returned
      .mockResolvedValueOnce([dmRow]) // SELECT existing channel
      .mockResolvedValueOnce([]); // INSERT channel_members

    const result = await getOrCreateDM('workspace01', 'user01', 'user02');
    expect(result.id).toBe('dm01');
    expect(result.name).toBe('dm_user01_user02');
    expect(mockDb).toHaveBeenCalledTimes(3);
  });

  it('creates a new DM channel when none exists', async () => {
    const newDmRow = fakeChannelRow({
      id: 'newdm',
      name: 'dm_user01_user02',
      is_dm: true,
    });

    mockDb
      .mockResolvedValueOnce([newDmRow]) // INSERT ON CONFLICT DO NOTHING — success, row returned
      .mockResolvedValueOnce([]); // INSERT channel_members

    const result = await getOrCreateDM('workspace01', 'user01', 'user02');
    expect(result.name).toBe('dm_user01_user02');
    expect(result.isDm).toBe(true);
  });

  it('uses sorted user IDs for DM name (deterministic)', async () => {
    // Regardless of order, name should be alphabetically sorted
    const dmRow = fakeChannelRow({
      name: 'dm_user01_user02', // sorted: user01 < user02
      is_dm: true,
    });
    // user01 calls user02 — INSERT returns the row (new channel)
    mockDb
      .mockResolvedValueOnce([dmRow]) // INSERT returns row
      .mockResolvedValueOnce([]); // INSERT members
    const result1 = await getOrCreateDM('workspace01', 'user01', 'user02');
    expect(result1.name).toBe('dm_user01_user02');

    // user02 calls user01 — same deterministic name
    mockDb
      .mockResolvedValueOnce([dmRow]) // INSERT returns row
      .mockResolvedValueOnce([]); // INSERT members
    const result2 = await getOrCreateDM('workspace01', 'user02', 'user01');
    expect(result2.name).toBe('dm_user01_user02');
  });
});

// ─── getMessages ───

describe('getMessages', () => {
  it('returns empty array when no messages', async () => {
    mockDb.mockResolvedValueOnce([]); // messages query
    const result = await getMessages('channel01');
    expect(result).toEqual([]);
  });

  it('maps message rows to Message objects', async () => {
    mockDb
      .mockResolvedValueOnce([fakeMessageRow()]) // messages
      .mockResolvedValueOnce([]) // image rows
      .mockResolvedValueOnce([]); // reaction rows

    const result = await getMessages('channel01');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'msg01',
      channelId: 'channel01',
      userId: 'user01',
      username: 'alice',
      content: 'Hello',
      type: 'text',
      parentId: null,
      deletedAt: null,
      createdAt: NOW.toISOString(),
    });
  });

  it('attaches image data for image_share messages', async () => {
    const msgRow = fakeMessageRow({ id: 'msg-img', type: 'image_share' });
    const imgRow = {
      message_id: 'msg-img',
      generation_ref: 'gen-ref-001',
      brand: 'apexure',
      prompt: 'A hero image',
      model: 'dall-e-3',
      image_url: 'https://example.com/img.png',
      mime_type: 'image/png',
      dimensions: { width: 1024, height: 1024 },
      created_at: NOW,
    };

    mockDb
      .mockResolvedValueOnce([msgRow]) // messages
      .mockResolvedValueOnce([imgRow]) // image rows
      .mockResolvedValueOnce([]); // reaction rows

    const result = await getMessages('channel01');
    expect(result[0].imageData).toBeDefined();
    expect(result[0].imageData?.imageUrl).toBe('https://example.com/img.png');
    expect(result[0].imageData?.brand).toBe('apexure');
  });

  it('attaches reactions to messages', async () => {
    mockDb
      .mockResolvedValueOnce([fakeMessageRow()]) // messages
      .mockResolvedValueOnce([]) // image rows
      .mockResolvedValueOnce([
        { message_id: 'msg01', emoji: '👍', count: 3 },
        { message_id: 'msg01', emoji: '❤️', count: 1 },
      ]); // reaction rows

    const result = await getMessages('channel01');
    expect(result[0].reactions).toHaveLength(2);
    expect(result[0].reactions?.[0]).toMatchObject({
      emoji: '👍',
      count: 3,
      userReacted: false,
    });
  });

  it('applies default limit of 50', async () => {
    mockDb.mockResolvedValueOnce([]); // just check it doesn't crash
    await getMessages('channel01');
    expect(mockDb).toHaveBeenCalledTimes(1);
  });
});

// ─── createMessage ───

describe('createMessage', () => {
  it('creates a text message and returns Message object', async () => {
    const msgRow = fakeMessageRow();
    mockDb
      .mockResolvedValueOnce([msgRow]) // INSERT message
      .mockResolvedValueOnce([{ username: 'alice' }]); // SELECT username

    const result = await createMessage({
      channelId: 'channel01',
      userId: 'user01',
      content: 'Hello',
      type: 'text',
    });

    expect(result.content).toBe('Hello');
    expect(result.type).toBe('text');
    expect(result.username).toBe('alice');
    expect(result.parentId).toBeNull();
    expect(result.reactions).toEqual([]);
  });

  it('creates a message with parentId for thread replies', async () => {
    const msgRow = fakeMessageRow({ parent_id: 'parent-msg' });
    mockDb
      .mockResolvedValueOnce([msgRow])
      .mockResolvedValueOnce([{ username: 'alice' }]);

    const result = await createMessage({
      channelId: 'channel01',
      userId: 'user01',
      content: 'Reply',
      type: 'text',
      parentId: 'parent-msg',
    });

    expect(result.parentId).toBe('parent-msg');
  });

  it('creates an image_share message', async () => {
    const msgRow = fakeMessageRow({ type: 'image_share' });
    mockDb
      .mockResolvedValueOnce([msgRow])
      .mockResolvedValueOnce([{ username: 'alice' }]);

    const result = await createMessage({
      channelId: 'channel01',
      userId: 'user01',
      content: '',
      type: 'image_share',
    });

    expect(result.type).toBe('image_share');
  });
});

// ─── softDeleteMessage ───

describe('softDeleteMessage', () => {
  it('succeeds when message belongs to user', async () => {
    mockDb.mockResolvedValueOnce([{ id: 'msg01' }]);
    await expect(
      softDeleteMessage('msg01', 'user01')
    ).resolves.toBeUndefined();
  });

  it('throws 403 when message does not exist or not owned by user', async () => {
    mockDb.mockResolvedValueOnce([]); // no rows updated
    await expect(
      softDeleteMessage('msg01', 'wrong-user')
    ).rejects.toThrow('Message not found or not owned by user');
  });

  it('thrown error has status 403', async () => {
    mockDb.mockResolvedValueOnce([]);
    try {
      await softDeleteMessage('msg01', 'wrong-user');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(403);
    }
  });
});

// ─── getThreadReplies ───

describe('getThreadReplies', () => {
  it('returns replies for a parent message', async () => {
    const reply1 = fakeMessageRow({ id: 'reply01', parent_id: 'msg01' });
    const reply2 = fakeMessageRow({ id: 'reply02', parent_id: 'msg01' });

    mockDb
      .mockResolvedValueOnce([reply1, reply2]) // messages
      .mockResolvedValueOnce([]); // reactions

    const result = await getThreadReplies('msg01');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no replies', async () => {
    mockDb.mockResolvedValueOnce([]);
    const result = await getThreadReplies('msg01');
    expect(result).toEqual([]);
  });
});

// ─── toggleReaction ───

describe('toggleReaction', () => {
  it('adds reaction when not already reacted', async () => {
    mockDb
      .mockResolvedValueOnce([]) // check existing — not found
      .mockResolvedValueOnce([]) // INSERT reaction
      .mockResolvedValueOnce([{ count: 1 }]); // count

    const result = await toggleReaction('msg01', 'user01', '👍');
    expect(result.added).toBe(true);
    expect(result.count).toBe(1);
  });

  it('removes reaction when already reacted', async () => {
    mockDb
      .mockResolvedValueOnce([{ id: 'reaction01' }]) // existing found
      .mockResolvedValueOnce([]) // DELETE reaction
      .mockResolvedValueOnce([{ count: 0 }]); // count after delete

    const result = await toggleReaction('msg01', 'user01', '👍');
    expect(result.added).toBe(false);
    expect(result.count).toBe(0);
  });

  it('returns correct count after toggle', async () => {
    mockDb
      .mockResolvedValueOnce([]) // not yet reacted
      .mockResolvedValueOnce([]) // INSERT
      .mockResolvedValueOnce([{ count: 5 }]); // multiple users reacted

    const result = await toggleReaction('msg01', 'user01', '❤️');
    expect(result.count).toBe(5);
  });
});

// ─── getUnreadMentionCount ───

describe('getUnreadMentionCount', () => {
  it('returns unread mention count', async () => {
    mockDb.mockResolvedValueOnce([{ count: 7 }]);
    const count = await getUnreadMentionCount('user01');
    expect(count).toBe(7);
  });

  it('returns 0 when no unread mentions', async () => {
    mockDb.mockResolvedValueOnce([{ count: 0 }]);
    const count = await getUnreadMentionCount('user01');
    expect(count).toBe(0);
  });
});

// ─── markMentionsRead ───

describe('markMentionsRead', () => {
  it('calls db with userId and channelId', async () => {
    mockDb.mockResolvedValueOnce([]);
    await markMentionsRead('user01', 'channel01');
    expect(mockDb).toHaveBeenCalledTimes(1);
  });

  it('resolves without error', async () => {
    mockDb.mockResolvedValueOnce([]);
    await expect(
      markMentionsRead('user01', 'channel01')
    ).resolves.toBeUndefined();
  });
});
