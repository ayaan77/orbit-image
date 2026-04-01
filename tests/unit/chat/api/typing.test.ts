import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@/lib/auth/types';

// ─── Mocks ───

vi.mock('@/lib/middleware/auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/chat/db', () => ({
  ChatError: class ChatError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'ChatError';
      this.status = status;
    }
  },
  getChannelById: vi.fn(),
  requireWorkspaceMember: vi.fn(),
}));

vi.mock('@/lib/chat/pusher', () => ({
  triggerPusher: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { getChannelById, requireWorkspaceMember } from '@/lib/chat/db';
import { triggerPusher } from '@/lib/chat/pusher';
import { POST } from '@/app/api/chat/channels/[cid]/typing/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockGetChannel = vi.mocked(getChannelById);
const mockRequireMember = vi.mocked(requireWorkspaceMember);
const mockTriggerPusher = vi.mocked(triggerPusher);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const TEST_CHANNEL = {
  id: 'ch_1',
  workspaceId: 'ws_1',
  name: 'general',
  description: null,
  isDm: false,
  createdBy: null,
  createdAt: '2025-01-01T00:00:00.000Z',
};

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost:3000/api/chat/channels/ch_1/typing', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat/channels/[cid]/typing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await POST(makeRequest({ event: 'start' }) as any, {
      params: Promise.resolve({ cid: 'ch_1' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid event value', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });

    const res = await POST(makeRequest({ event: 'invalid' }) as any, {
      params: Promise.resolve({ cid: 'ch_1' }),
    });

    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain('"start" or "stop"');
  });

  it('returns 404 when channel not found', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetChannel.mockResolvedValue(null);

    const res = await POST(makeRequest({ event: 'start' }) as any, {
      params: Promise.resolve({ cid: 'ch_1' }),
    });

    expect(res.status).toBe(404);
  });

  it('triggers typing.start Pusher event', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetChannel.mockResolvedValue(TEST_CHANNEL as any);
    mockRequireMember.mockResolvedValue('member');

    const res = await POST(makeRequest({ event: 'start' }) as any, {
      params: Promise.resolve({ cid: 'ch_1' }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockTriggerPusher).toHaveBeenCalledWith(
      'private-channel-ch_1',
      'typing.start',
      { userId: TEST_USER.id, username: TEST_USER.username }
    );
  });

  it('triggers typing.stop Pusher event', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetChannel.mockResolvedValue(TEST_CHANNEL as any);
    mockRequireMember.mockResolvedValue('member');

    const res = await POST(makeRequest({ event: 'stop' }) as any, {
      params: Promise.resolve({ cid: 'ch_1' }),
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockTriggerPusher).toHaveBeenCalledWith(
      'private-channel-ch_1',
      'typing.stop',
      { userId: TEST_USER.id, username: TEST_USER.username }
    );
  });

  it('returns 403 when user is not a workspace member', async () => {
    const { ChatError } = await import('@/lib/chat/db');
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetChannel.mockResolvedValue(TEST_CHANNEL as any);
    mockRequireMember.mockRejectedValue(
      new ChatError('Not a member of this workspace', 403)
    );

    const res = await POST(makeRequest({ event: 'start' }) as any, {
      params: Promise.resolve({ cid: 'ch_1' }),
    });

    expect(res.status).toBe(403);
  });
});
