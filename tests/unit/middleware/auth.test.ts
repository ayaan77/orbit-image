import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClientInfo } from "@/lib/auth/types";

// In-memory KV store for client key lookups
const kvStore = new Map<string, unknown>();

vi.mock("@/lib/storage/kv", () => ({
  getKv: () => ({
    get: vi.fn(async <T>(key: string): Promise<T | null> => {
      return (kvStore.get(key) as T) ?? null;
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      kvStore.set(key, value);
    }),
    hset: vi.fn(async () => {}),
  }),
}));

const { authenticateRequest } = await import("@/lib/middleware/auth");
const { hashApiKey } = await import("@/lib/auth/keys");
const { authResultToResponse } = await import("@/lib/middleware/auth-helpers");

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers["authorization"] = `Bearer ${token}`;
  }
  return new Request("http://localhost:3000/api/test", { headers });
}

describe("authenticateRequest", () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it("returns error when no Authorization header", async () => {
    const result = await authenticateRequest(
      new Request("http://localhost:3000/api/test"),
    );
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.code).toBe("UNAUTHORIZED");
      expect(result.message).toContain("Missing");
    }
  });

  it("returns master type for correct master key", async () => {
    // The test setup sets API_SECRET_KEY to "test-secret"
    const result = await authenticateRequest(makeRequest("test-secret"));
    expect(result.type).toBe("master");
  });

  it("returns error for invalid key with no KV clients", async () => {
    const result = await authenticateRequest(makeRequest("wrong-key"));
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("returns client type for valid client key in KV", async () => {
    const clientKey = "oimg_live_abc123def456789012345678abcd0123";
    const hash = hashApiKey(clientKey);
    const clientInfo: ClientInfo = {
      clientId: "client_001",
      clientName: "Test Client",
      createdAt: "2026-03-26T00:00:00Z",
      active: true,
    };

    kvStore.set(`oimg:keys:${hash}`, clientInfo);

    const result = await authenticateRequest(makeRequest(clientKey));
    expect(result.type).toBe("client");
    if (result.type === "client") {
      expect(result.client.clientId).toBe("client_001");
      expect(result.client.clientName).toBe("Test Client");
    }
  });

  it("returns error for revoked (inactive) client key", async () => {
    const clientKey = "oimg_live_aabbccdd00112233445566778899eeff";
    const hash = hashApiKey(clientKey);
    const clientInfo: ClientInfo = {
      clientId: "client_revoked",
      clientName: "Revoked Client",
      createdAt: "2026-03-26T00:00:00Z",
      active: false,
    };

    kvStore.set(`oimg:keys:${hash}`, clientInfo);

    const result = await authenticateRequest(makeRequest(clientKey));
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("revoked");
    }
  });

  it("strips Bearer prefix from token", async () => {
    // With "Bearer " prefix, should still match master key
    const result = await authenticateRequest(makeRequest("test-secret"));
    expect(result.type).toBe("master");
  });

  it("works without Bearer prefix", async () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { authorization: "test-secret" },
    });
    const result = await authenticateRequest(request);
    expect(result.type).toBe("master");
  });
});

describe("authResultToResponse", () => {
  it("returns null for master auth", () => {
    expect(authResultToResponse({ type: "master" })).toBeNull();
  });

  it("returns null for client auth", () => {
    const result = authResultToResponse({
      type: "client",
      client: {
        clientId: "c1",
        clientName: "Test",
        createdAt: "2026-01-01",
        active: true,
      },
    });
    expect(result).toBeNull();
  });

  it("returns 401 response for error auth", async () => {
    const response = authResultToResponse({
      type: "error",
      code: "UNAUTHORIZED",
      message: "Invalid API key",
    });

    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);

    const body = await response!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Invalid API key");
  });
});
