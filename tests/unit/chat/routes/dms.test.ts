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
  getDMs: vi.fn(),
  getOrCreateDM: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { validateRequestBody } from '@/lib/middleware/validation';
import { requireWorkspaceMember, getDMs, getOrCreateDM } from '@/lib/chat/db';
import { GET, POST } from '@/app/api/chat/workspaces/[wid]/dms/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockRequireMember = vi.mocked(requireWorkspaceMember);
const mockGetDMs = vi.mocked(getDMs);
const mockGetOrCreateDM = vi.mocked(getOrCreateDM);
const mockValidateBody = vi.mocked(validateRequestBody);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const TEST_DM = {
  id: 'ch_dm1',
  workspaceId: 'ws_1',
  name: 'dm_usr_test1_usr_test2',
  description: null,
  isDm: true,
  createdBy: 'usr_test1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const paramsPromise = Promise.resolve({ wid: 'ws_1' });

function makeRequest(method = 'GET'): Request {
  return new Request('http://localhost:3000/api/chat/workspaces/ws_1/dms', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST'
      ? { body: JSON.stringify({ targetUserId: 'usr_test2' }) }
      : {}),
  });
}

describe('GET /api/chat/workspaces/[wid]/dms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns DM channels', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('member');
    mockGetDMs.mockResolvedValue([TEST_DM]);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channels).toHaveLength(1);
    expect(data.channels[0].isDm).toBe(true);
  });
});

describe('POST /api/chat/workspaces/[wid]/dms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens or returns existing DM', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('member');
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { targetUserId: 'usr_test2' },
    } as any);
    mockGetOrCreateDM.mockResolvedValue(TEST_DM);

    const res = await POST(makeRequest('POST') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channel.id).toBe('ch_dm1');
    expect(mockGetOrCreateDM).toHaveBeenCalledWith(
      'ws_1',
      'usr_test1',
      'usr_test2',
    );
  });
});
