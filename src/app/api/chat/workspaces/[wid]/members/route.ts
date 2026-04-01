import { authenticateRequest } from '@/lib/middleware/auth';
import {
  ChatError,
  requireWorkspaceMember,
  searchWorkspaceMembers,
} from '@/lib/chat/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wid: string }> },
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
    const { wid } = await params;
    await requireWorkspaceMember(wid, userId);

    const url = new URL(req.url);
    const query = url.searchParams.get('q') ?? '';
    const members = await searchWorkspaceMembers(wid, query, 10);
    return NextResponse.json({ members });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] member search error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
