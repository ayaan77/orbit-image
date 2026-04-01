import { z } from 'zod';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import {
  ChatError,
  requireWorkspaceMember,
  getChannels,
  createChannel,
} from '@/lib/chat/db';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CreateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Name must be lowercase alphanumeric with hyphens only',
    ),
  description: z.string().max(256).optional(),
});

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
    const channels = await getChannels(wid);
    return NextResponse.json({ channels });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] channels list error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
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
    const role = await requireWorkspaceMember(wid, userId);

    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin or owner role required to create channels' },
        { status: 403 },
      );
    }

    const validation = await validateRequestBody(req, CreateChannelSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, description } = validation.data;
    const channel = await createChannel({
      workspaceId: wid,
      name,
      description,
      createdBy: userId,
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    if (err instanceof ChatError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[chat] channel create error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
