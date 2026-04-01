import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@/lib/auth/types';

// ─── Mocks ───

vi.mock('@/lib/middleware/auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/middleware/validation', () => ({
  validateRequestBody: vi.fn(),
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
  requireWorkspaceMember: vi.fn(),
  getChannelById: vi.fn(),
}));

vi.mock('@/lib/chat/pusher', () => ({
  getPusher: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import {
  requireWorkspaceMember,
  getChannelById,
  ChatError,
} from '@/lib/chat/db';
import { getPusher } from '@/lib/chat/pusher';
import { POST } from '@/app/api/chat/pusher/auth/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockValidateBody = vi.mocked(validateRequestBody);
const mockRequireMember = vi.mocked(requireWorkspaceMember);
const mockGetChannel = vi.mocked(getChannelById);
const mockGetPusher = vi.mocked(getPusher);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/chat/pusher/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      socket_id: '123.456',
      channel_name: 'private-workspace-ws_1234567890abcdef12345678',
    }),
  });
}

describe('POST /api/chat/pusher/auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('authorizes workspace channel subscription', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        socket_id: '123.456',
        channel_name: 'private-workspace-ws_1234567890abcdef12345678',
      },
    } as any);
    mockRequireMember.mockResolvedValue('member');

    const mockAuthorize = vi.fn().mockReturnValue({
      auth: 'pusher-key:signature',
    });
    mockGetPusher.mockReturnValue({
      authorizeChannel: mockAuthorize,
    } as any);

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.auth).toBe('pusher-key:signature');
    expect(mockRequireMember).toHaveBeenCalledWith('ws_1234567890abcdef12345678', 'usr_test1');
  });

  it('authorizes channel subscription via workspace lookup', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        socket_id: '123.456',
        channel_name: 'private-channel-ch_1234567890abcdef12345678',
      },
    } as any);
    mockGetChannel.mockResolvedValue({
      id: 'ch_1234567890abcdef12345678',
      workspaceId: 'ws_1234567890abcdef12345678',
      name: 'general',
      description: null,
      isDm: false,
      createdBy: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    mockRequireMember.mockResolvedValue('member');

    const mockAuthorize = vi.fn().mockReturnValue({
      auth: 'pusher-key:signature',
    });
    mockGetPusher.mockReturnValue({
      authorizeChannel: mockAuthorize,
    } as any);

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetChannel).toHaveBeenCalledWith('ch_1234567890abcdef12345678');
    expect(mockRequireMember).toHaveBeenCalledWith('ws_1234567890abcdef12345678', 'usr_test1');
  });

  it('authorizes own mentions channel', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        socket_id: '123.456',
        channel_name: 'private-mentions-usr_test1',
      },
    } as any);

    const mockAuthorize = vi.fn().mockReturnValue({
      auth: 'pusher-key:signature',
    });
    mockGetPusher.mockReturnValue({
      authorizeChannel: mockAuthorize,
    } as any);

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.auth).toBe('pusher-key:signature');
  });

  it('returns 403 for wrong user mentions channel', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        socket_id: '123.456',
        channel_name: 'private-mentions-usr_other',
      },
    } as any);

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("another user's mentions");
  });

  it('returns 403 for non-member workspace channel', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        socket_id: '123.456',
        channel_name: 'private-workspace-ws_1234567890abcdef12345678',
      },
    } as any);
    mockRequireMember.mockRejectedValue(
      new ChatError('Not a member of this workspace', 403),
    );

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Not a member of this workspace');
  });

  it('returns 503 when Pusher not configured', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        socket_id: '123.456',
        channel_name: 'private-workspace-ws_1234567890abcdef12345678',
      },
    } as any);
    mockRequireMember.mockResolvedValue('member');
    mockGetPusher.mockReturnValue(null);

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toBe('Pusher not configured');
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await POST(makeRequest() as any);
    expect(res.status).toBe(401);
  });
});
