import { randomBytes } from 'crypto';
import { getDb } from '@/lib/storage/db';
import type {
  Channel,
  Message,
  MessageImage,
  Reaction,
  Workspace,
  WorkspaceRole,
} from './types';

// ─── Typed Error ───

export class ChatError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ChatError';
  }
}

// ─── ID Generation ───

const newWorkspaceId = () => `ws_${randomBytes(12).toString('hex')}`;
const newChannelId   = () => `ch_${randomBytes(12).toString('hex')}`;
const newMessageId   = () => `msg_${randomBytes(12).toString('hex')}`;
const newReactionId  = () => `rxn_${randomBytes(12).toString('hex')}`;

// ─── Row Mappers ───

function rowToWorkspace(
  row: Record<string, unknown>,
  role?: WorkspaceRole
): Workspace {
  return {
    id: row.id as string,
    brandId: row.brand_id as string,
    name: row.name as string,
    slug: row.slug as string,
    createdAt: (row.created_at as Date).toISOString(),
    role,
  };
}

function rowToChannel(row: Record<string, unknown>): Channel {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    isDm: row.is_dm as boolean,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: (row.created_at as Date).toISOString(),
    unreadMentions:
      row.unread_mentions != null ? Number(row.unread_mentions) : undefined,
  };
}

function rowToMessageImage(
  row: Record<string, unknown> | null | undefined
): MessageImage | undefined {
  if (!row) return undefined;
  const dims = row.dimensions as { width: number; height: number };
  return {
    messageId: row.message_id as string,
    generationRef: (row.generation_ref as string | null) ?? null,
    brand: row.brand as string,
    prompt: row.prompt as string,
    model: row.model as string,
    imageUrl: row.image_url as string,
    mimeType: row.mime_type as string,
    dimensions: { width: dims.width, height: dims.height },
  };
}

function rowToMessage(
  row: Record<string, unknown>,
  imageRow?: Record<string, unknown> | null,
  reactions?: readonly Reaction[],
  replyCount?: number
): Message {
  return {
    id: row.id as string,
    channelId: row.channel_id as string,
    userId: row.user_id as string,
    username: row.username as string,
    content: row.content as string,
    type: row.type as 'text' | 'image_share',
    parentId: (row.parent_id as string | null) ?? null,
    deletedAt:
      row.deleted_at != null
        ? (row.deleted_at as Date).toISOString()
        : null,
    createdAt: (row.created_at as Date).toISOString(),
    imageData: rowToMessageImage(imageRow ?? undefined),
    reactions: reactions ?? [],
    replyCount: replyCount ?? 0,
  };
}

// ─── Workspace Queries ───

export async function getWorkspacesForUser(
  userId: string
): Promise<Workspace[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db`
    SELECT w.*, wm.role
    FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ${userId}
    ORDER BY w.created_at ASC
  `;

  return rows.map((r) =>
    rowToWorkspace(r, r.role as WorkspaceRole)
  );
}

// ─── Membership Guard ───

export async function requireWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole> {
  const db = getDb();
  if (!db) throw new ChatError('Database not configured', 503);

  const rows = await db`
    SELECT role FROM workspace_members
    WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new ChatError('Not a member of this workspace', 403);
  }

  return rows[0].role as WorkspaceRole;
}

// ─── Channel Queries ───

export async function getChannels(workspaceId: string): Promise<Channel[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db`
    SELECT * FROM channels
    WHERE workspace_id = ${workspaceId} AND is_dm = FALSE
    ORDER BY created_at ASC
  `;

  return rows.map(rowToChannel);
}

export async function getDMs(
  workspaceId: string,
  userId: string
): Promise<Channel[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db`
    SELECT c.* FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id
    WHERE c.workspace_id = ${workspaceId}
      AND c.is_dm = TRUE
      AND cm.user_id = ${userId}
    ORDER BY c.created_at ASC
  `;

  return rows.map(rowToChannel);
}

export async function getOrCreateDM(
  workspaceId: string,
  userId: string,
  targetUserId: string
): Promise<Channel> {
  const db = getDb();
  if (!db) throw new ChatError('Database not configured', 503);

  const dmName = `dm_${[userId, targetUserId].sort().join('_')}`;

  const existing = await db`
    SELECT * FROM channels
    WHERE workspace_id = ${workspaceId} AND name = ${dmName}
    LIMIT 1
  `;

  if (existing.length > 0) {
    return rowToChannel(existing[0]);
  }

  const id = newChannelId();

  const created = await db`
    INSERT INTO channels (id, workspace_id, name, is_dm, created_by)
    VALUES (${id}, ${workspaceId}, ${dmName}, TRUE, ${userId})
    RETURNING *
  `;

  const channel = rowToChannel(created[0]);

  // Add both users as members
  await db`
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (${id}, ${userId}), (${id}, ${targetUserId})
    ON CONFLICT DO NOTHING
  `;

  return channel;
}

// ─── Message Queries ───

export async function getMessages(
  channelId: string,
  cursor?: string,
  limit = 50
): Promise<Message[]> {
  const db = getDb();
  if (!db) return [];

  const safeLimit = Math.min(limit, 100);

  // Fetch messages with username, optionally with cursor (newest first)
  const rows = cursor
    ? await db`
        SELECT m.*, u.username,
          (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id AND r.deleted_at IS NULL)::int AS reply_count
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ${channelId}
          AND m.parent_id IS NULL
          AND m.deleted_at IS NULL
          AND m.created_at < (SELECT created_at FROM messages WHERE id = ${cursor})
        ORDER BY m.created_at DESC
        LIMIT ${safeLimit}
      `
    : await db`
        SELECT m.*, u.username,
          (SELECT COUNT(*) FROM messages r WHERE r.parent_id = m.id AND r.deleted_at IS NULL)::int AS reply_count
        FROM messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel_id = ${channelId}
          AND m.parent_id IS NULL
          AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT ${safeLimit}
      `;

  if (rows.length === 0) return [];

  const messageIds = rows.map((r) => r.id as string);

  // Fetch image data for image_share messages
  const imageRows = await db`
    SELECT * FROM message_images WHERE message_id = ANY(${messageIds}::text[])
  `;
  const imageMap = new Map<string, Record<string, unknown>>();
  for (const img of imageRows) {
    imageMap.set(img.message_id as string, img);
  }

  // Fetch reactions for all messages
  const reactionRows = await db`
    SELECT message_id, emoji, COUNT(*)::int AS count
    FROM message_reactions
    WHERE message_id = ANY(${messageIds}::text[])
    GROUP BY message_id, emoji
    ORDER BY message_id, emoji
  `;
  const reactionMap = new Map<string, Reaction[]>();
  for (const r of reactionRows) {
    const msgId = r.message_id as string;
    const existing = reactionMap.get(msgId) ?? [];
    existing.push({
      emoji: r.emoji as string,
      count: r.count as number,
      userReacted: false, // populated per-user at API level if needed
    });
    reactionMap.set(msgId, existing);
  }

  return rows.map((row) =>
    rowToMessage(
      row,
      imageMap.get(row.id as string),
      reactionMap.get(row.id as string) ?? [],
      row.reply_count as number
    )
  );
}

export async function createMessage(data: {
  readonly channelId: string;
  readonly userId: string;
  readonly content: string;
  readonly type: 'text' | 'image_share';
  readonly parentId?: string;
}): Promise<Message> {
  const db = getDb();
  if (!db) throw new ChatError('Database not configured', 503);

  const id = newMessageId();

  const rows = await db`
    INSERT INTO messages (id, channel_id, user_id, content, type, parent_id)
    VALUES (
      ${id},
      ${data.channelId},
      ${data.userId},
      ${data.content},
      ${data.type},
      ${data.parentId ?? null}
    )
    RETURNING *
  `;

  const usernameRows = await db`
    SELECT username FROM users WHERE id = ${data.userId} LIMIT 1
  `;
  const username = (usernameRows[0]?.username as string) ?? '';

  return rowToMessage({ ...rows[0], username }, undefined, [], 0);
}

export async function softDeleteMessage(
  messageId: string,
  userId: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new ChatError('Database not configured', 503);

  const rows = await db`
    UPDATE messages
    SET deleted_at = NOW(), content = ''
    WHERE id = ${messageId} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  `;

  if (rows.length === 0) {
    throw new ChatError('Message not found or not owned by user', 403);
  }
}

export async function getThreadReplies(parentId: string): Promise<Message[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db`
    SELECT m.*, u.username
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.parent_id = ${parentId} AND m.deleted_at IS NULL
    ORDER BY m.created_at ASC
  `;

  if (rows.length === 0) return [];

  const messageIds = rows.map((r) => r.id as string);

  const reactionRows = await db`
    SELECT message_id, emoji, COUNT(*)::int AS count
    FROM message_reactions
    WHERE message_id = ANY(${messageIds}::text[])
    GROUP BY message_id, emoji
    ORDER BY message_id, emoji
  `;
  const reactionMap = new Map<string, Reaction[]>();
  for (const r of reactionRows) {
    const msgId = r.message_id as string;
    const existing = reactionMap.get(msgId) ?? [];
    existing.push({
      emoji: r.emoji as string,
      count: r.count as number,
      userReacted: false,
    });
    reactionMap.set(msgId, existing);
  }

  return rows.map((row) =>
    rowToMessage(row, undefined, reactionMap.get(row.id as string) ?? [], 0)
  );
}

// ─── Reaction Queries ───

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string
): Promise<{ readonly added: boolean; readonly count: number }> {
  const db = getDb();
  if (!db) throw new ChatError('Database not configured', 503);

  // Check if reaction already exists
  const existing = await db`
    SELECT id FROM message_reactions
    WHERE message_id = ${messageId} AND user_id = ${userId} AND emoji = ${emoji}
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Remove reaction
    await db`
      DELETE FROM message_reactions
      WHERE message_id = ${messageId} AND user_id = ${userId} AND emoji = ${emoji}
    `;

    const countRows = await db`
      SELECT COUNT(*)::int AS count FROM message_reactions
      WHERE message_id = ${messageId} AND emoji = ${emoji}
    `;

    return { added: false, count: countRows[0].count as number };
  }

  // Add reaction
  const id = newReactionId();
  await db`
    INSERT INTO message_reactions (id, message_id, user_id, emoji)
    VALUES (${id}, ${messageId}, ${userId}, ${emoji})
    ON CONFLICT (message_id, user_id, emoji) DO NOTHING
  `;

  const countRows = await db`
    SELECT COUNT(*)::int AS count FROM message_reactions
    WHERE message_id = ${messageId} AND emoji = ${emoji}
  `;

  return { added: true, count: countRows[0].count as number };
}

// ─── Mention Queries ───

export async function getUnreadMentionCount(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  const rows = await db`
    SELECT COUNT(*)::int AS count FROM mentions
    WHERE mentioned_user_id = ${userId} AND read_at IS NULL
  `;

  return rows[0].count as number;
}

export async function markMentionsRead(
  userId: string,
  channelId: string
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db`
    UPDATE mentions
    SET read_at = NOW()
    WHERE mentioned_user_id = ${userId}
      AND read_at IS NULL
      AND message_id IN (
        SELECT id FROM messages WHERE channel_id = ${channelId}
      )
  `;
}

// ─── Channel Creation ───

export async function createChannel(data: {
  readonly workspaceId: string;
  readonly name: string;
  readonly description?: string;
  readonly createdBy: string;
}): Promise<Channel> {
  const db = getDb();
  if (!db) throw new ChatError('Database not configured', 503);

  const id = newChannelId();

  const rows = await db`
    INSERT INTO channels (id, workspace_id, name, description, is_dm, created_by)
    VALUES (${id}, ${data.workspaceId}, ${data.name}, ${data.description ?? null}, FALSE, ${data.createdBy})
    RETURNING *
  `;

  return rowToChannel(rows[0]);
}

// ─── Member Search ───

export async function searchWorkspaceMembers(
  workspaceId: string,
  query: string,
  limit = 10
): Promise<{ readonly id: string; readonly username: string }[]> {
  const db = getDb();
  if (!db) return [];

  const safeLimit = Math.min(limit, 50);
  const pattern = `%${query}%`;

  const rows = await db`
    SELECT u.id, u.username
    FROM users u
    JOIN workspace_members wm ON wm.user_id = u.id
    WHERE wm.workspace_id = ${workspaceId}
      AND u.username ILIKE ${pattern}
    ORDER BY u.username ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((r) => ({
    id: r.id as string,
    username: r.username as string,
  }));
}

// ─── Image Data ───

export async function insertImageData(data: {
  readonly messageId: string;
  readonly brand: string;
  readonly prompt: string;
  readonly model: string;
  readonly imageUrl: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly generationRef?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db`
    INSERT INTO message_images (message_id, brand, prompt, model, image_url, mime_type, dimensions, generation_ref)
    VALUES (
      ${data.messageId},
      ${data.brand},
      ${data.prompt},
      ${data.model},
      ${data.imageUrl},
      ${data.mimeType},
      ${JSON.stringify(data.dimensions)},
      ${data.generationRef ?? null}
    )
    ON CONFLICT (message_id) DO NOTHING
  `;
}

// ─── Channel Lookup ───

export async function getChannelById(
  channelId: string
): Promise<Channel | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db`
    SELECT * FROM channels WHERE id = ${channelId} LIMIT 1
  `;

  if (rows.length === 0) return null;
  return rowToChannel(rows[0]);
}
