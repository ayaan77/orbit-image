import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock getDb ───
const mockDb = vi.fn();

vi.mock("@/lib/storage/db", () => ({
  getDb: () => mockDb,
}));

import {
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  cleanExpiredSessions,
  getSessionIdFromRequest,
  buildSessionCookie,
  buildClearSessionCookie,
} from "@/lib/auth/sessions";

// ─── Helpers ───

const NOW = new Date("2025-06-01T00:00:00Z");

function fakeSessionJoinRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "usr_abc123",
    username: "alice",
    email: "alice@example.com",
    role: "user",
    rate_limit: null,
    monthly_budget_usd: null,
    active: true,
    created_at: NOW,
    updated_at: NOW,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function makeRequest(cookieHeader?: string): Request {
  const headers = new Headers();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  return new Request("http://localhost/api/test", { headers });
}

// ─── Tests ───

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSessionIdFromRequest", () => {
  it("extracts a valid 64-hex-char session ID from cookies", () => {
    const validId = "a".repeat(64);
    const req = makeRequest(`orbit-session=${validId}`);

    expect(getSessionIdFromRequest(req)).toBe(validId);
  });

  it("returns null when no cookie header is present", () => {
    const req = makeRequest();

    expect(getSessionIdFromRequest(req)).toBeNull();
  });

  it("returns null when orbit-session cookie is missing", () => {
    const req = makeRequest("other-cookie=value");

    expect(getSessionIdFromRequest(req)).toBeNull();
  });

  it("rejects a session ID that is not 64 hex chars", () => {
    const req = makeRequest("orbit-session=tooshort");

    expect(getSessionIdFromRequest(req)).toBeNull();
  });

  it("rejects a session ID with invalid characters", () => {
    // 64 chars but contains uppercase G which is not hex
    const badId = "G".repeat(64);
    const req = makeRequest(`orbit-session=${badId}`);

    expect(getSessionIdFromRequest(req)).toBeNull();
  });

  it("handles multiple cookies correctly", () => {
    const validId = "b".repeat(64);
    const req = makeRequest(`other=foo; orbit-session=${validId}; another=bar`);

    expect(getSessionIdFromRequest(req)).toBe(validId);
  });
});

describe("buildSessionCookie", () => {
  it("includes the session ID", () => {
    const cookie = buildSessionCookie("mysessionid");

    expect(cookie).toContain("orbit-session=mysessionid");
  });

  it("includes HttpOnly flag", () => {
    const cookie = buildSessionCookie("id");

    expect(cookie).toContain("HttpOnly");
  });

  it("includes Secure flag", () => {
    const cookie = buildSessionCookie("id");

    expect(cookie).toContain("Secure");
  });

  it("includes SameSite=Lax", () => {
    const cookie = buildSessionCookie("id");

    expect(cookie).toContain("SameSite=Lax");
  });

  it("includes Path=/", () => {
    const cookie = buildSessionCookie("id");

    expect(cookie).toContain("Path=/");
  });

  it("includes a Max-Age of 7 days", () => {
    const cookie = buildSessionCookie("id");
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;

    expect(cookie).toContain(`Max-Age=${sevenDaysInSeconds}`);
  });
});

describe("buildClearSessionCookie", () => {
  it("sets Max-Age=0 to expire the cookie", () => {
    const cookie = buildClearSessionCookie();

    expect(cookie).toContain("Max-Age=0");
  });

  it("clears the orbit-session value", () => {
    const cookie = buildClearSessionCookie();

    expect(cookie).toContain("orbit-session=;");
  });

  it("retains security flags", () => {
    const cookie = buildClearSessionCookie();

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});

describe("createSession", () => {
  it("inserts a session row and returns a 64-hex-char session ID", async () => {
    mockDb.mockResolvedValueOnce([]);

    const sessionId = await createSession("usr_abc123");

    expect(sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(mockDb).toHaveBeenCalledTimes(1);
  });

  it("generates unique session IDs on each call", async () => {
    mockDb.mockResolvedValue([]);

    const id1 = await createSession("usr_abc123");
    const id2 = await createSession("usr_abc123");

    expect(id1).not.toBe(id2);
  });
});

describe("getSession", () => {
  it("returns the user when session is valid and user is active", async () => {
    mockDb.mockResolvedValueOnce([fakeSessionJoinRow()]);

    const user = await getSession("a".repeat(64));

    expect(user).not.toBeNull();
    expect(user!.username).toBe("alice");
    expect(user!.id).toBe("usr_abc123");
  });

  it("returns null when session is not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const user = await getSession("a".repeat(64));

    expect(user).toBeNull();
  });

  it("returns null and deletes an expired session", async () => {
    const expiredRow = fakeSessionJoinRow({
      expires_at: new Date("2020-01-01T00:00:00Z").toISOString(),
    });
    mockDb
      .mockResolvedValueOnce([expiredRow]) // SELECT join
      .mockResolvedValueOnce([]);           // DELETE

    const user = await getSession("a".repeat(64));

    expect(user).toBeNull();
    // The second db call is the DELETE for the expired session
    expect(mockDb).toHaveBeenCalledTimes(2);
  });

  it("returns null when user is inactive", async () => {
    mockDb.mockResolvedValueOnce([fakeSessionJoinRow({ active: false })]);

    const user = await getSession("a".repeat(64));

    expect(user).toBeNull();
  });
});

describe("deleteSession", () => {
  it("calls db to delete the session", async () => {
    mockDb.mockResolvedValueOnce([]);

    await deleteSession("a".repeat(64));

    expect(mockDb).toHaveBeenCalledTimes(1);
  });
});

describe("deleteUserSessions", () => {
  it("calls db to delete all sessions for a user", async () => {
    mockDb.mockResolvedValueOnce([]);

    await deleteUserSessions("usr_abc123");

    expect(mockDb).toHaveBeenCalledTimes(1);
  });
});

describe("cleanExpiredSessions", () => {
  it("returns the number of cleaned sessions", async () => {
    mockDb.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]);

    const count = await cleanExpiredSessions();

    expect(count).toBe(2);
  });

  it("returns 0 when no sessions are expired", async () => {
    mockDb.mockResolvedValueOnce([]);

    const count = await cleanExpiredSessions();

    expect(count).toBe(0);
  });
});
