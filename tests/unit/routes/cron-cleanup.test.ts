import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ───

vi.mock("@/lib/mcp/blob", () => ({
  cleanupExpiredBlobs: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { cleanupExpiredBlobs } from "@/lib/mcp/blob";
import { GET } from "@/app/api/cron/cleanup-blobs/route";

const mockCleanupExpiredBlobs = vi.mocked(cleanupExpiredBlobs);

function makeCronRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request("http://localhost:3000/api/cron/cleanup-blobs", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/cleanup-blobs", () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it("returns 401 when CRON_SECRET is not set", async () => {
    const req = makeCronRequest("some-secret");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when wrong secret is provided", async () => {
    process.env.CRON_SECRET = "correct-secret";

    const req = makeCronRequest("wrong-secret");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when no authorization header is provided", async () => {
    process.env.CRON_SECRET = "correct-secret";

    const req = makeCronRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 200 with cleanup results when correct secret is provided", async () => {
    process.env.CRON_SECRET = "correct-secret";
    mockCleanupExpiredBlobs.mockResolvedValue({ deleted: 5, errors: 1 });

    const req = makeCronRequest("correct-secret");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(5);
    expect(data.errors).toBe(1);
    expect(mockCleanupExpiredBlobs).toHaveBeenCalledOnce();
  });

  it("returns 200 with zero counts when nothing to clean", async () => {
    process.env.CRON_SECRET = "my-cron-secret";
    mockCleanupExpiredBlobs.mockResolvedValue({ deleted: 0, errors: 0 });

    const req = makeCronRequest("my-cron-secret");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deleted).toBe(0);
    expect(data.errors).toBe(0);
  });
});
