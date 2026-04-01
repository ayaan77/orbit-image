import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { ChatError, requireWorkspaceMember, getChannelById } from '@/lib/chat/db';
import { getPusher } from '@/lib/chat/pusher';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PusherAuthSchema = z.object({
  socket_id: z.string().min(1),
  channel_name: z.string().min(1),
});

export async function POST(req: NextRequest) {
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
    const validation = await validateRequestBody(req, PusherAuthSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { socket_id: socketId, channel_name: channelName } = validation.data;

    // Parse and authorize channel name
    if (channelName.startsWith('private-workspace-')) {
      const wid = channelName.replace('private-workspace-', '');
      await requireWorkspaceMember(wid, userId);
    } else if (channelName.startsWith('private-channel-')) {
      const cid = channelName.replace('private-channel-', '');
      const channel = await getChannelById(cid);
      if (!channel) {
        return NextResponse.json(
          { error: 'Channel not found' },
          { status: 403 },
        );
      }
      await requireWorkspaceMember(channel.workspaceId, userId);
    } else if (channelName.startsWith('private-mentions-')) {
      const uid = channelName.replace('private-mentions-', '');
      if (uid !== userId) {
        return NextResponse.json(
          { error: 'Cannot subscribe to another user\'s mentions' },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unknown channel type' },
        { status: 403 },
      );
    }

    const pusher = getPusher();
    if (!pusher) {
      return NextResponse.json(
        { error: 'Pusher not configured' },
        { status: 503 },
      );
    }

    const authResponse = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] pusher auth error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
