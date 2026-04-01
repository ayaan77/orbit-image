import { authenticateRequest } from '@/lib/middleware/auth';
import { ChatError } from '@/lib/chat/db';
import { syncWorkspacesFromCortex } from '@/lib/chat/workspace';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth.type === 'error') {
    return NextResponse.json({ error: auth.message }, { status: 401 });
  }

  if (auth.type !== 'master') {
    return NextResponse.json(
      { error: 'Master key required' },
      { status: 403 },
    );
  }

  try {
    await syncWorkspacesFromCortex();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] workspace sync error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
