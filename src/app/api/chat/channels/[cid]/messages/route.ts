import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import {
  ChatError,
  getMessages,
  createMessage,
  getChannelById,
  getMessageById,
  requireWorkspaceMember,
  insertImageData,
} from '@/lib/chat/db';
import { parseMentions, insertMentions } from '@/lib/chat/mentions';
import { triggerPusher } from '@/lib/chat/pusher';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Message ID format for cursor / parentId validation
const MSG_ID_RE = /^msg_[0-9a-f]{24}$/;

const SendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  type: z.enum(['text', 'image_share']).default('text'),
  parentId: z.string().regex(MSG_ID_RE).optional(),
  imageData: z
    .object({
      brand: z.string(),
      prompt: z.string(),
      model: z.string(),
      // Must be HTTPS to prevent SSRF-by-proxy and user tracking via arbitrary URLs
      imageUrl: z.string().url().refine((u) => u.startsWith('https://'), {
        message: 'imageUrl must use HTTPS',
      }),
      mimeType: z.string(),
      dimensions: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
      generationRef: z.string().optional(),
    })
    .optional(),
});

export async function GET(
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

  try {
    const { cid } = await params;

    // Look up channel to verify workspace membership
    const channel = await getChannelById(cid);
    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 },
      );
    }
    await requireWorkspaceMember(channel.workspaceId, userId);

    const url = new URL(req.url);
    const rawBefore = url.searchParams.get('before');
    // Validate cursor format to prevent unnecessary full-table scans
    const before =
      rawBefore && MSG_ID_RE.test(rawBefore) ? rawBefore : undefined;
    const limitParam = parseInt(
      url.searchParams.get('limit') ?? '50',
      10,
    );
    const limit = Math.min(Math.max(limitParam, 1), 100);

    const messages = await getMessages(cid, before, limit);
    const hasMore = messages.length === limit;

    return NextResponse.json({ messages, hasMore });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] messages list error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

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
  const username =
    auth.type === 'user'
      ? auth.user.username
      : auth.type === 'client'
        ? auth.client.clientName
        : '';
  // Master key is not a user identity — chat requires a real user or client
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit message sends at 60/min per user, keyed by userId
  const rateLimitResponse = await checkRateLimit(req, 60, `chat:msg:${userId}`);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { cid } = await params;

    // Look up channel to verify workspace membership
    const channel = await getChannelById(cid);
    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 },
      );
    }
    await requireWorkspaceMember(channel.workspaceId, userId);

    const validation = await validateRequestBody(req, SendMessageSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { content, type = 'text', parentId, imageData } = validation.data;

    // Verify parentId belongs to this channel to prevent cross-channel data leaks
    if (parentId) {
      const parentMsg = await getMessageById(parentId);
      if (!parentMsg || parentMsg.channelId !== cid) {
        return NextResponse.json(
          { error: 'Parent message not found in this channel' },
          { status: 400 },
        );
      }
    }

    const message = await createMessage({
      channelId: cid,
      userId,
      content,
      type,
      parentId,
    });

    // Insert image data if this is an image_share
    if (type === 'image_share' && imageData) {
      await insertImageData({
        messageId: message.id,
        brand: imageData.brand,
        prompt: imageData.prompt,
        model: imageData.model,
        imageUrl: imageData.imageUrl,
        mimeType: imageData.mimeType,
        dimensions: imageData.dimensions,
        generationRef: imageData.generationRef,
      });
    }

    // Parse and insert mentions
    const mentionedUserIds = await parseMentions(
      content,
      channel.workspaceId,
    );
    if (mentionedUserIds.length > 0) {
      await insertMentions(message.id, mentionedUserIds);
    }

    // Fire Pusher events — failures are non-fatal; message is already saved
    try {
      await triggerPusher(`private-channel-${cid}`, 'message.created', {
        message,
        author: { id: userId, username },
      });
      for (const mentionedUserId of mentionedUserIds) {
        await triggerPusher(
          `private-mentions-${mentionedUserId}`,
          'mention.created',
          {
            messageId: message.id,
            channelId: cid,
            from: { id: userId, username },
          },
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
    console.error('[chat] message send error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
