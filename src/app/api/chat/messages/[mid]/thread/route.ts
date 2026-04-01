import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import {
  ChatError,
  createMessage,
  getMessageChannelId,
  getThreadReplies,
  requireWorkspaceMember,
} from '@/lib/chat/db';
import { parseMentions, insertMentions } from '@/lib/chat/mentions';
import { triggerPusher } from '@/lib/chat/pusher';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ThreadReplySchema = z.object({
  content: z.string().min(1).max(4000),
});

export async function GET(
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

    const msgRef = await getMessageChannelId(mid);
    if (!msgRef) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    await requireWorkspaceMember(msgRef.workspaceId, userId);

    const replies = await getThreadReplies(mid);
    return NextResponse.json({ replies });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] thread replies error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

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
  const username =
    auth.type === 'user'
      ? auth.user.username
      : auth.type === 'client'
        ? auth.client.clientName
        : '';
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(req, 60, `chat:msg:${userId}`);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { mid } = await params;

    const msgRef = await getMessageChannelId(mid);
    if (!msgRef) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    await requireWorkspaceMember(msgRef.workspaceId, userId);

    const validation = await validateRequestBody(req, ThreadReplySchema);
    if (!validation.success) return validation.response;

    const { content } = validation.data;

    const message = await createMessage({
      channelId: msgRef.channelId,
      userId,
      content,
      type: 'text',
      parentId: mid,
    });

    const mentionedUserIds = await parseMentions(content, msgRef.workspaceId);
    if (mentionedUserIds.length > 0) {
      await insertMentions(message.id, mentionedUserIds);
    }

    try {
      await triggerPusher(
        `private-channel-${msgRef.channelId}`,
        'thread.reply',
        { parentId: mid, message, author: { id: userId, username } },
      );
      for (const mentionedUserId of mentionedUserIds) {
        await triggerPusher(
          `private-mentions-${mentionedUserId}`,
          'mention.created',
          { messageId: message.id, channelId: msgRef.channelId, from: { id: userId, username } },
        );
      }
    } catch (pusherErr) {
      console.error('[chat] Pusher trigger failed (non-fatal):', pusherErr);
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] thread reply error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
