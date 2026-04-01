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
  getChannels: vi.fn(),
  createChannel: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import {
  requireWorkspaceMember,
  getChannels,
  createChannel,
  ChatError,
} from '@/lib/chat/db';
import { GET, POST } from '@/app/api/chat/workspaces/[wid]/channels/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockRequireMember = vi.mocked(requireWorkspaceMember);
const mockGetChannels = vi.mocked(getChannels);
const mockCreateChannel = vi.mocked(createChannel);
const mockValidateBody = vi.mocked(validateRequestBody);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const TEST_CHANNEL = {
  id: 'ch_1',
  workspaceId: 'ws_1',
  name: 'general',
  description: 'General discussion',
  isDm: false,
  createdBy: 'usr_test1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

function makeRequest(method = 'GET'): Request {
  return new Request(
    'http://localhost:3000/api/chat/workspaces/ws_1/channels',
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(method === 'POST'
        ? { body: JSON.stringify({ name: 'general' }) }
        : {}),
    },
  );
}

const paramsPromise = Promise.resolve({ wid: 'ws_1' });

describe('GET /api/chat/workspaces/[wid]/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Missing authentication');
  });

  it('returns 403 when not workspace member', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockRejectedValue(
      new ChatError('Not a member of this workspace', 403),
    );

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Not a member of this workspace');
  });

  it('returns channels for workspace member', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('member');
    mockGetChannels.mockResolvedValue([TEST_CHANNEL]);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channels).toHaveLength(1);
    expect(data.channels[0].name).toBe('general');
  });
});

describe('POST /api/chat/workspaces/[wid]/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when user is not admin/owner', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('member');

    const res = await POST(makeRequest('POST') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('Admin or owner role required');
  });

  it('creates channel for admin', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('admin');
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { name: 'new-channel', description: 'A new channel' },
    } as any);
    mockCreateChannel.mockResolvedValue({
      ...TEST_CHANNEL,
      name: 'new-channel',
    });

    const res = await POST(makeRequest('POST') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.channel.name).toBe('new-channel');
    expect(mockCreateChannel).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      name: 'new-channel',
      description: 'A new channel',
      createdBy: 'usr_test1',
    });
  });
});
