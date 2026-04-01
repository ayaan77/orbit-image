import { authenticateRequest } from '@/lib/middleware/auth';
import { isAdmin } from '@/lib/middleware/admin-auth';
import {
  ChatError,
  requireWorkspaceMember,
  searchWorkspaceMembers,
} from '@/lib/chat/db';
import { addMemberToWorkspace } from '@/lib/chat/workspace';
import { getUserByUsername } from '@/lib/auth/users';
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

/**
 * POST /api/chat/workspaces/[wid]/members — Add a member to a workspace (admin only).
 * Body: { username: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ wid: string }> },
) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { username } = body;
  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'username is required' }, { status: 400 });
  }

  try {
    const { wid } = await params;

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: `User "${username}" not found` }, { status: 404 });
    }

    await addMemberToWorkspace(wid, user.id, 'member');
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] add member error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
