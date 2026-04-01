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
  toggleReaction: vi.fn(),
}));

vi.mock('@/lib/storage/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/chat/pusher', () => ({
  triggerPusher: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { toggleReaction } from '@/lib/chat/db';
import { getDb } from '@/lib/storage/db';
import { triggerPusher } from '@/lib/chat/pusher';
import { POST } from '@/app/api/chat/messages/[mid]/reactions/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockValidateBody = vi.mocked(validateRequestBody);
const mockToggleReaction = vi.mocked(toggleReaction);
const mockGetDb = vi.mocked(getDb);
const mockTriggerPusher = vi.mocked(triggerPusher);

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
  return new Request(
    'http://localhost:3000/api/chat/messages/msg_1/reactions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: 'thumbsup' }),
    },
  );
}

describe('POST /api/chat/messages/[mid]/reactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggles reaction and fires Pusher', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { emoji: 'thumbsup' },
    } as any);
    mockToggleReaction.mockResolvedValue({ added: true, count: 1 });

    // Mock DB query for channel lookup
    const mockDbQuery = vi.fn().mockResolvedValue([
      { channel_id: 'ch_1' },
    ]);
    // The db is a tagged template function, so we need a callable mock
    mockGetDb.mockReturnValue(mockDbQuery as any);
    mockTriggerPusher.mockResolvedValue();

    const res = await POST(makeRequest() as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.added).toBe(true);
    expect(data.count).toBe(1);
    expect(mockToggleReaction).toHaveBeenCalledWith(
      'msg_1',
      'usr_test1',
      'thumbsup',
    );
    expect(mockTriggerPusher).toHaveBeenCalledWith(
      'private-channel-ch_1',
      'reaction.toggled',
      {
        messageId: 'msg_1',
        emoji: 'thumbsup',
        count: 1,
        added: true,
      },
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await POST(makeRequest() as any, {
      params: paramsPromise,
    });
    expect(res.status).toBe(401);
  });
});
