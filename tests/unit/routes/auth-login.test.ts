import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { User } from "@/lib/auth/types";

// ─── Mocks ───

vi.mock("@/lib/auth/users", () => ({
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/auth/sessions", () => ({
  createSession: vi.fn(),
  buildSessionCookie: vi.fn(),
  cleanExpiredSessions: vi.fn(),
}));

vi.mock("@/lib/middleware/ip-rate-limit", () => ({
  checkIpRateLimit: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { verifyPassword } from "@/lib/auth/users";
import { createSession, buildSessionCookie, cleanExpiredSessions } from "@/lib/auth/sessions";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";
import { POST } from "@/app/api/auth/login/route";

const mockVerifyPassword = vi.mocked(verifyPassword);
const mockCreateSession = vi.mocked(createSession);
const mockBuildSessionCookie = vi.mocked(buildSessionCookie);
const mockCleanExpiredSessions = vi.mocked(cleanExpiredSessions);
const mockCheckIpRateLimit = vi.mocked(checkIpRateLimit);

const TEST_USER: User = {
  id: "usr_abc123",
  username: "testuser",
  email: "test@example.com",
  role: "user",
  active: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function makeLoginRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckIpRateLimit.mockReturnValue(null);
    mockCleanExpiredSessions.mockResolvedValue(0);
  });

  it("returns 429 when rate limited", async () => {
    const rateLimitResponse = NextResponse.json(
      { success: false as const, error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    );
    mockCheckIpRateLimit.mockReturnValue(rateLimitResponse);

    const req = makeLoginRequest({ username: "user", password: "pass" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("RATE_LIMITED");
  });

  it("returns 400 for missing username", async () => {
    const req = makeLoginRequest({ password: "pass" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 for missing password", async () => {
    const req = makeLoginRequest({ username: "user" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 for empty body", async () => {
    const req = makeLoginRequest({});
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 401 for invalid credentials", async () => {
    mockVerifyPassword.mockResolvedValue(null);

    const req = makeLoginRequest({ username: "wrong", password: "bad" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
    expect(mockVerifyPassword).toHaveBeenCalledWith("wrong", "bad");
  });

  it("returns 200 with user and Set-Cookie on valid login", async () => {
    mockVerifyPassword.mockResolvedValue(TEST_USER);
    mockCreateSession.mockResolvedValue("session-id-abc");
    mockBuildSessionCookie.mockReturnValue("orbit-session=session-id-abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800");

    const req = makeLoginRequest({ username: "testuser", password: "correct" });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toEqual({
      id: "usr_abc123",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    });
    expect(res.headers.get("set-cookie")).toContain("orbit-session=session-id-abc");
    expect(mockCreateSession).toHaveBeenCalledWith("usr_abc123");
    expect(mockBuildSessionCookie).toHaveBeenCalledWith("session-id-abc");
  });

  it("calls cleanExpiredSessions in the background after successful login", async () => {
    mockVerifyPassword.mockResolvedValue(TEST_USER);
    mockCreateSession.mockResolvedValue("sess-123");
    mockBuildSessionCookie.mockReturnValue("orbit-session=sess-123;");

    const req = makeLoginRequest({ username: "testuser", password: "correct" });
    await POST(req);

    expect(mockCleanExpiredSessions).toHaveBeenCalled();
  });
});
