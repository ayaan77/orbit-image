import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock getDb ───
// By default returns mockDb; individual tests can override via mockGetDb.
const mockDb = vi.fn() as ReturnType<typeof vi.fn>;
let mockGetDb: () => ReturnType<typeof vi.fn> | null = () => mockDb;

vi.mock('@/lib/storage/db', () => ({
  getDb: () => mockGetDb(),
}));

// Mock Cortex client to avoid network calls in syncWorkspacesFromCortex
vi.mock('@/lib/cortex/cached-client', () => ({
  createCachedCortexClient: () => ({
    listBrands: vi.fn().mockResolvedValue([]),
  }),
}));

import { addMemberToWorkspace } from '@/lib/chat/workspace';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDb = () => mockDb; // restore default to mockDb
});

// ─── addMemberToWorkspace ───

describe('addMemberToWorkspace', () => {
  it('inserts member with default "member" role', async () => {
    mockDb.mockResolvedValueOnce([]);

    await addMemberToWorkspace('workspace01', 'user01');

    expect(mockDb).toHaveBeenCalledTimes(1);
  });

  it('upserts (ON CONFLICT updates role) — still a single db call', async () => {
    mockDb.mockResolvedValueOnce([]);

    await addMemberToWorkspace('workspace01', 'user01', 'admin');

    expect(mockDb).toHaveBeenCalledTimes(1);
  });

  it('no-ops gracefully when DB is not configured', async () => {
    mockGetDb = () => null;

    // addMemberToWorkspace should return without touching the db
    await expect(
      addMemberToWorkspace('workspace01', 'user01')
    ).resolves.toBeUndefined();

    expect(mockDb).not.toHaveBeenCalled();
  });
});
