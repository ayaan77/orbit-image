import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAdmin, isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";

vi.mock("@/lib/middleware/auth", () => ({
  authenticateRequest: vi.fn(),
}));

import { authenticateRequest } from "@/lib/middleware/auth";
const mockAuth = vi.mocked(authenticateRequest);

function makeRequest(apiKey?: string): Request {
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return new Request("http://localhost/api/admin/test", { headers });
}

describe("isAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for master key auth", async () => {
    mockAuth.mockResolvedValue({ type: "master" });
    expect(await isAdmin(makeRequest("master-key"))).toBe(true);
  });

  it("returns true for admin user", async () => {
    mockAuth.mockResolvedValue({
      type: "user",
      user: {
        id: "usr_123",
        username: "admin",
        role: "admin",
        active: true,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
    });
    expect(await isAdmin(makeRequest("token"))).toBe(true);
  });

  it("returns false for non-admin user", async () => {
    mockAuth.mockResolvedValue({
      type: "user",
      user: {
        id: "usr_456",
        username: "regular",
        role: "user",
        active: true,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      },
    });
    expect(await isAdmin(makeRequest("token"))).toBe(false);
  });

  it("returns false for client auth", async () => {
    mockAuth.mockResolvedValue({
      type: "client",
      client: {
        clientId: "c1",
        clientName: "app",
        createdAt: "2024-01-01",
        active: true,
      },
    });
    expect(await isAdmin(makeRequest("token"))).toBe(false);
  });

  it("returns false for auth error", async () => {
    mockAuth.mockResolvedValue({
      type: "error",
      code: "UNAUTHORIZED",
      message: "Missing auth",
    });
    expect(await isAdmin(makeRequest())).toBe(false);
  });
});

describe("isMasterKey (deprecated)", () => {
  it("delegates to isAdmin", async () => {
    mockAuth.mockResolvedValue({ type: "master" });
    expect(await isMasterKey(makeRequest("key"))).toBe(true);
  });
});

describe("unauthorizedResponse", () => {
  it("returns 401 with error body", () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
  });

  it("includes custom headers", async () => {
    const res = unauthorizedResponse({ "X-Custom": "test" });
    expect(res.headers.get("X-Custom")).toBe("test");
  });

  it("body contains UNAUTHORIZED code", async () => {
    const res = unauthorizedResponse();
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
