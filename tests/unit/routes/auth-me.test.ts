import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { User } from "@/lib/auth/types";

// ─── Mocks ───

vi.mock("@/lib/auth/sessions", () => ({
  getSessionIdFromRequest: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/middleware/ip-rate-limit", () => ({
  checkIpRateLimit: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { getSessionIdFromRequest, getSession } from "@/lib/auth/sessions";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";
import { GET } from "@/app/api/auth/me/route";

const mockGetSessionIdFromRequest = vi.mocked(getSessionIdFromRequest);
const mockGetSession = vi.mocked(getSession);
const mockCheckIpRateLimit = vi.mocked(checkIpRateLimit);

const TEST_USER: User = {
  id: "usr_abc123",
  username: "testuser",
  email: "test@example.com",
  role: "admin",
  active: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function makeMeRequest(cookie?: string): Request {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers["cookie"] = cookie;
  }
  return new Request("http://localhost:3000/api/auth/me", {
    method: "GET",
    headers,
  });
}

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckIpRateLimit.mockReturnValue(null);
  });

  it("returns 429 when rate limited", async () => {
    const rateLimitResponse = NextResponse.json(
      { success: false as const, error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    );
    mockCheckIpRateLimit.mockReturnValue(rateLimitResponse);

    const req = makeMeRequest("orbit-session=abc123");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.success).toBe(false);
  });

  it("returns 401 when no session cookie", async () => {
    mockGetSessionIdFromRequest.mockReturnValue(null);

    const req = makeMeRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(data.error.message).toBe("Not logged in");
  });

  it("returns 401 when session expired or invalid", async () => {
    mockGetSessionIdFromRequest.mockReturnValue("expired-session-id");
    mockGetSession.mockResolvedValue(null);

    const req = makeMeRequest("orbit-session=expired-session-id");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(data.error.message).toBe("Session expired");
    expect(mockGetSession).toHaveBeenCalledWith("expired-session-id");
  });

  it("returns 200 with user data on valid session", async () => {
    mockGetSessionIdFromRequest.mockReturnValue("valid-session-id");
    mockGetSession.mockResolvedValue(TEST_USER);

    const req = makeMeRequest("orbit-session=valid-session-id");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toEqual({
      id: "usr_abc123",
      username: "testuser",
      email: "test@example.com",
      role: "admin",
    });
    expect(mockGetSession).toHaveBeenCalledWith("valid-session-id");
  });
});
