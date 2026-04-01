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
}));

vi.mock('@/lib/chat/workspace', () => ({
  syncWorkspacesFromCortex: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { authenticateRequest } from '@/lib/middleware/auth';
import { syncWorkspacesFromCortex } from '@/lib/chat/workspace';
import { POST } from '@/app/api/chat/workspaces/sync/route';

const mockAuth = vi.mocked(authenticateRequest);
const mockSync = vi.mocked(syncWorkspacesFromCortex);

const TEST_USER: User = {
  id: 'usr_test1',
  username: 'testuser',
  role: 'user',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/chat/workspaces/sync', {
    method: 'POST',
  });
}

describe('POST /api/chat/workspaces/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Missing authentication',
    });

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Missing authentication');
  });

  it('returns 403 when not master key', async () => {
    mockAuth.mockResolvedValue({ type: 'user', user: TEST_USER });

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Master key required');
  });

  it('syncs workspaces with master key', async () => {
    mockAuth.mockResolvedValue({ type: 'master' });
    mockSync.mockResolvedValue();

    const res = await POST(makeRequest() as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSync).toHaveBeenCalled();
  });
});
