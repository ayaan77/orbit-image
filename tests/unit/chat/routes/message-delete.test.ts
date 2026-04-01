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
  softDeleteMessage: vi.fn(),
  getMessageChannelId: vi.fn(),
  requireWorkspaceMember: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { softDeleteMessage, ChatError, getMessageChannelId, requireWorkspaceMember } from '@/lib/chat/db';
import { DELETE } from '@/app/api/chat/messages/[mid]/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockSoftDelete = vi.mocked(softDeleteMessage);
const mockGetMessageChannelId = vi.mocked(getMessageChannelId);
const mockRequireWorkspaceMember = vi.mocked(requireWorkspaceMember);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const paramsPromise = Promise.resolve({ mid: 'msg_1' });

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/chat/messages/msg_1', {
    method: 'DELETE',
  });
}

describe('DELETE /api/chat/messages/[mid]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes own message', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetMessageChannelId.mockResolvedValue({ channelId: 'ch_1', workspaceId: 'ws_1' });
    mockRequireWorkspaceMember.mockResolvedValue('member');
    mockSoftDelete.mockResolvedValue();

    const res = await DELETE(makeRequest() as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSoftDelete).toHaveBeenCalledWith('msg_1', 'usr_test1');
  });

  it('returns 404 when message does not exist', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetMessageChannelId.mockResolvedValue(null);

    const res = await DELETE(makeRequest() as any, {
      params: paramsPromise,
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when trying to delete someone else\'s message', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetMessageChannelId.mockResolvedValue({ channelId: 'ch_1', workspaceId: 'ws_1' });
    mockRequireWorkspaceMember.mockResolvedValue('member');
    mockSoftDelete.mockRejectedValue(
      new ChatError('Message not found or not owned by user', 403),
    );

    const res = await DELETE(makeRequest() as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Message not found or not owned by user');
  });
});
