import { authenticateRequest } from '@/lib/middleware/auth';
import {
  ChatError,
  getMessageChannelId,
  getThreadReplies,
  requireWorkspaceMember,
} from '@/lib/chat/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
