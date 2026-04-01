import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware/auth';
import { ChatError, getChannelById, requireWorkspaceMember } from '@/lib/chat/db';
import { triggerPusher } from '@/lib/chat/pusher';
import { createLogger } from '@/lib/logging/logger';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const logger = createLogger({ service: 'chat:typing' });

const TypingSchema = z.object({
  event: z.enum(['start', 'stop']),
});

/**
 * POST /api/chat/channels/[cid]/typing
 * Body: { event: 'start' | 'stop' }
 *
 * Broadcasts a typing.start or typing.stop event on the channel's Pusher channel.
 * Requires workspace membership.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cid: string }> },
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

  const username =
    auth.type === 'user'
      ? auth.user.username
      : auth.type === 'client'
        ? auth.client.clientId
        : userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = TypingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'event must be "start" or "stop"' }, { status: 400 });
  }

  const { event } = parsed.data;

  try {
    const { cid } = await params;

    const channel = await getChannelById(cid);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    await requireWorkspaceMember(channel.workspaceId, userId);

    const pusherEvent = event === 'start' ? 'typing.start' : 'typing.stop';
    await triggerPusher(`private-channel-${cid}`, pusherEvent, {
      userId,
      username,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error('typing event error', { error: err });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
