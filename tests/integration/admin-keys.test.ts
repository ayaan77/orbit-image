import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @upstash/redis with an in-memory store
const mockStore = new Map<string, unknown>();
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(async (key: string) => mockStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      mockStore.set(key, value);
    }),
    hset: vi.fn(async (key: string, fields: Record<string, unknown>) => {
      const existing = (mockStore.get(key) as Record<string, unknown>) ?? {};
      mockStore.set(key, { ...existing, ...fields });
    }),
    hget: vi.fn(async (key: string, field: string) => {
      const hash = mockStore.get(key) as Record<string, unknown> | undefined;
      return hash?.[field] ?? null;
    }),
    hgetall: vi.fn(async (key: string) => {
      return (mockStore.get(key) as Record<string, unknown>) ?? null;
    }),
    hlen: vi.fn(async (key: string) => {
      const hash = mockStore.get(key) as Record<string, unknown> | undefined;
      return hash ? Object.keys(hash).length : 0;
    }),
    hscan: vi.fn(async (key: string, cursor: number, opts?: { count?: number }) => {
      const hash = mockStore.get(key) as Record<string, unknown> | undefined;
      if (!hash) return [0, []];
      // Return all entries in a single scan (simulating small dataset)
      const entries: unknown[] = [];
      for (const [field, value] of Object.entries(hash)) {
        entries.push(field, value);
      }
      return [0, entries]; // cursor 0 = done
    }),
  })),
}));

// Stub KV env vars so getKv() returns a client
vi.stubEnv("KV_REST_API_URL", "https://fake-kv.upstash.io");
vi.stubEnv("KV_REST_API_TOKEN", "fake-token");

const { POST, GET, DELETE: DELETE_HANDLER } = await import(
  "@/app/api/admin/keys/route"
);

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  apiKey?: string
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey !== undefined) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    headers["Authorization"] = "Bearer test-secret";
  }

  return new Request("http://localhost:3000/api/admin/keys", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/admin/keys", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("rejects non-master key", async () => {
    const req = makeRequest("POST", { clientName: "TestApp" }, "wrong-key");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("requires clientName", async () => {
    const req = makeRequest("POST", {});
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.message).toContain("clientName");
  });

  it("creates a new client key", async () => {
    const req = makeRequest("POST", { clientName: "TestApp" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.apiKey).toMatch(/^oimg_live_[a-f0-9]{32}$/);
    expect(data.client.clientName).toBe("TestApp");
    expect(data.client.active).toBe(true);
    expect(data.client.clientId).toBeTruthy();
  });
});

describe("GET /api/admin/keys", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("rejects non-master key", async () => {
    const req = makeRequest("GET", undefined, "wrong-key");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty list when no clients", async () => {
    const req = makeRequest("GET");
    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.clients).toEqual([]);
  });

  it("lists created clients", async () => {
    // Create a client first
    const createReq = makeRequest("POST", { clientName: "ListTestApp" });
    await POST(createReq);

    const req = makeRequest("GET");
    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.clients).toHaveLength(1);
    expect(data.clients[0].clientName).toBe("ListTestApp");
    // Raw key should NOT be in the list
    expect(data.clients[0]).not.toHaveProperty("apiKey");
  });
});

describe("DELETE /api/admin/keys", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("rejects non-master key", async () => {
    const req = makeRequest("DELETE", { clientId: "abc" }, "wrong-key");
    const res = await DELETE_HANDLER(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown clientId", async () => {
    const req = makeRequest("DELETE", { clientId: "nonexistent" });
    const res = await DELETE_HANDLER(req);
    expect(res.status).toBe(404);
  });

  it("revokes an existing client key", async () => {
    // Create first
    const createReq = makeRequest("POST", { clientName: "RevokeTestApp" });
    const createRes = await POST(createReq);
    const { client } = await createRes.json();

    // Revoke
    const req = makeRequest("DELETE", { clientId: client.clientId });
    const res = await DELETE_HANDLER(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.message).toBe("Key revoked");

    // Verify it's inactive
    const listReq = makeRequest("GET");
    const listRes = await GET(listReq);
    const listData = await listRes.json();
    const revoked = listData.clients.find(
      (c: { clientId: string }) => c.clientId === client.clientId
    );
    expect(revoked.active).toBe(false);
  });
});
