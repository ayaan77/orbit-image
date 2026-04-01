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
  getUnreadMentionCount: vi.fn(),
  markMentionsRead: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { getUnreadMentionCount, markMentionsRead } from '@/lib/chat/db';
import { GET } from '@/app/api/chat/mentions/route';
import { POST } from '@/app/api/chat/mentions/read/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockValidateBody = vi.mocked(validateRequestBody);
const mockGetCount = vi.mocked(getUnreadMentionCount);
const mockMarkRead = vi.mocked(markMentionsRead);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/api/chat/mentions', {
    method: 'GET',
  });
}

function makePostRequest(): Request {
  return new Request('http://localhost:3000/api/chat/mentions/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId: 'ch_1' }),
  });
}

describe('GET /api/chat/mentions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns unread mention count', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetCount.mockResolvedValue(3);

    const res = await GET(makeGetRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(3);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await GET(makeGetRequest() as any);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/chat/mentions/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks mentions as read', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { channelId: 'ch_1' },
    } as any);
    mockMarkRead.mockResolvedValue();

    const res = await POST(makePostRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockMarkRead).toHaveBeenCalledWith('usr_test1', 'ch_1');
  });
});
