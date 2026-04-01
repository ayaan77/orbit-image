import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@/lib/auth/types';

// ─── Mocks ───

vi.mock('@/lib/middleware/auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/chat/db', () => ({
  ChatError: class ChatError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ChatError';
      this.status = status;
    }
  },
  getThreadReplies: vi.fn(),
  getMessageChannelId: vi.fn(),
  requireWorkspaceMember: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { getThreadReplies, getMessageChannelId, requireWorkspaceMember } from '@/lib/chat/db';
import { GET } from '@/app/api/chat/messages/[mid]/thread/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockGetReplies = vi.mocked(getThreadReplies);
const mockGetMessageChannelId = vi.mocked(getMessageChannelId);
const mockRequireWorkspaceMember = vi.mocked(requireWorkspaceMember);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const paramsPromise = Promise.resolve({ mid: 'msg_1' });

function makeRequest(): Request {
  return new Request(
    'http://localhost:3000/api/chat/messages/msg_1/thread',
    { method: 'GET' },
  );
}

describe('GET /api/chat/messages/[mid]/thread', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns thread replies', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetMessageChannelId.mockResolvedValue({ channelId: 'ch_1', workspaceId: 'ws_1' });
    mockRequireWorkspaceMember.mockResolvedValue('member');
    mockGetReplies.mockResolvedValue([
      {
        id: 'msg_reply1',
        channelId: 'ch_1',
        userId: 'usr_test1',
        username: 'testuser',
        content: 'Reply to thread',
        type: 'text',
        parentId: 'msg_1',
        deletedAt: null,
        createdAt: '2025-01-01T00:01:00.000Z',
        reactions: [],
        replyCount: 0,
      },
    ]);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.replies).toHaveLength(1);
    expect(data.replies[0].parentId).toBe('msg_1');
  });

  it('returns 404 when message does not exist', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetMessageChannelId.mockResolvedValue(null);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    expect(res.status).toBe(401);
  });
});
