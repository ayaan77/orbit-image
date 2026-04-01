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
  requireWorkspaceMember: vi.fn(),
  searchWorkspaceMembers: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import {
  requireWorkspaceMember,
  searchWorkspaceMembers,
} from '@/lib/chat/db';
import { GET } from '@/app/api/chat/workspaces/[wid]/members/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockRequireMember = vi.mocked(requireWorkspaceMember);
const mockSearchMembers = vi.mocked(searchWorkspaceMembers);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const paramsPromise = Promise.resolve({ wid: 'ws_1' });

function makeRequest(query = ''): Request {
  return new Request(
    `http://localhost:3000/api/chat/workspaces/ws_1/members${query}`,
    { method: 'GET' },
  );
}

describe('GET /api/chat/workspaces/[wid]/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns members matching search query', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('member');
    mockSearchMembers.mockResolvedValue([
      { id: 'usr_test1', username: 'testuser' },
    ]);

    const res = await GET(makeRequest('?q=test') as any, {
      params: paramsPromise,
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(1);
    expect(data.members[0].username).toBe('testuser');
    expect(mockSearchMembers).toHaveBeenCalledWith('ws_1', 'test', 10);
  });

  it('searches with empty query', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockRequireMember.mockResolvedValue('member');
    mockSearchMembers.mockResolvedValue([]);

    const res = await GET(makeRequest() as any, { params: paramsPromise });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.members).toHaveLength(0);
    expect(mockSearchMembers).toHaveBeenCalledWith('ws_1', '', 10);
  });
});
