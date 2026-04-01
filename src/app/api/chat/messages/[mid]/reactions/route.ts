import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { ChatError, toggleReaction } from '@/lib/chat/db';
import { getDb } from '@/lib/storage/db';
import { triggerPusher } from '@/lib/chat/pusher';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ReactionSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[\p{Emoji}\p{Emoji_Component}\w]+$/u, 'Invalid emoji'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mid: string }> },
) {
  const auth = await authenticateRequest(req);
  if (auth.type === 'error') {
    return NextResponse.json({ error: auth.message }, { status: 401 });
  }

  const userId =
    auth.type === 'user'
      ? auth.user.id
      : auth.type === 'client'
        ? auth.client.clientId
        : null;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { mid } = await params;

    const validation = await validateRequestBody(req, ReactionSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { emoji } = validation.data;
    const { added, count } = await toggleReaction(mid, userId, emoji);

    // Look up the message's channel for Pusher
    const db = getDb();
    if (db) {
      const rows = await db`SELECT channel_id FROM messages WHERE id = ${mid}`;
      if (rows.length > 0) {
        const channelId = rows[0].channel_id as string;
        await triggerPusher(
          `private-channel-${channelId}`,
          'reaction.toggled',
          { messageId: mid, emoji, count, added },
        );
      }
    }

    return NextResponse.json({ added, count });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] reaction toggle error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
