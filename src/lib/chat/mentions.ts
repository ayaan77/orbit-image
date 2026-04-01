import { randomBytes } from 'crypto';
import { getDb } from '@/lib/storage/db';

const MENTION_PATTERN = /@(\w+)/g;

const newMentionId = () => `men_${randomBytes(12).toString('hex')}`;

/**
 * Parse @mentions from message content, resolve usernames to user IDs
 * within the given workspace, and return unique user IDs found.
 */
export async function parseMentions(
  content: string,
  workspaceId: string
): Promise<string[]> {
  const db = getDb();
  if (!db) return [];

  const matches = content.matchAll(MENTION_PATTERN);
  const usernames = new Set<string>();

  for (const match of matches) {
    const username = match[1];
    if (username) {
      usernames.add(username);
    }
  }

  if (usernames.size === 0) return [];

  const usernameList = [...usernames];

  // Resolve usernames to user IDs within the workspace
  const rows = await db`
    SELECT DISTINCT u.id FROM users u
    JOIN workspace_members wm ON wm.user_id = u.id
    WHERE wm.workspace_id = ${workspaceId}
      AND u.username = ANY(${usernameList}::text[])
  `;

  return rows.map((r) => r.id as string);
}

/**
 * Bulk insert mention records for the given message and user IDs.
 */
export async function insertMentions(
  messageId: string,
  userIds: string[]
): Promise<void> {
  const db = getDb();
  if (!db || userIds.length === 0) return;

  for (const userId of userIds) {
    const id = newMentionId();
    await db`
      INSERT INTO mentions (id, message_id, mentioned_user_id)
      VALUES (${id}, ${messageId}, ${userId})
      ON CONFLICT (message_id, mentioned_user_id) DO NOTHING
    `;
  }
}
