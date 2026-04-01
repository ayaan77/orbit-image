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
  getWorkspacesForUser: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { getWorkspacesForUser } from '@/lib/chat/db';
import { GET } from '@/app/api/chat/workspaces/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockGetWorkspaces = vi.mocked(getWorkspacesForUser);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function makeRequest(method = 'GET'): Request {
  return new Request('http://localhost:3000/api/chat/workspaces', { method });
}

describe('GET /api/chat/workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await GET(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Missing authentication');
  });

  it('returns workspaces for authenticated user', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });
    mockGetWorkspaces.mockResolvedValue([
      {
        id: 'ws_1',
        brandId: 'apexure',
        name: 'Apexure',
        slug: 'apexure',
        createdAt: '2025-01-01T00:00:00.000Z',
        role: 'member',
      },
    ]);

    const res = await GET(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.workspaces).toHaveLength(1);
    expect(data.workspaces[0].id).toBe('ws_1');
    expect(mockGetWorkspaces).toHaveBeenCalledWith('usr_test1');
  });
});
