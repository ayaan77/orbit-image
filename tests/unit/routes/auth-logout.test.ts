import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───

vi.mock("@/lib/auth/sessions", () => ({
  deleteSession: vi.fn(),
  getSessionIdFromRequest: vi.fn(),
  buildClearSessionCookie: vi.fn(),
}));

// ─── Imports (after mocks) ───

import { deleteSession, getSessionIdFromRequest, buildClearSessionCookie } from "@/lib/auth/sessions";
import { POST } from "@/app/api/auth/logout/route";

const mockDeleteSession = vi.mocked(deleteSession);
const mockGetSessionIdFromRequest = vi.mocked(getSessionIdFromRequest);
const mockBuildClearSessionCookie = vi.mocked(buildClearSessionCookie);

function makeLogoutRequest(cookie?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cookie) {
    headers["cookie"] = cookie;
  }
  return new Request("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildClearSessionCookie.mockReturnValue(
      "orbit-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    );
  });

  it("returns 200 with clear cookie header when session exists", async () => {
    mockGetSessionIdFromRequest.mockReturnValue("session-to-delete");
    mockDeleteSession.mockResolvedValue(undefined);

    const req = makeLogoutRequest("orbit-session=session-to-delete");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("orbit-session=");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mockDeleteSession).toHaveBeenCalledWith("session-to-delete");
  });

  it("returns 200 with clear cookie header even when no session exists", async () => {
    mockGetSessionIdFromRequest.mockReturnValue(null);

    const req = makeLogoutRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it("calls buildClearSessionCookie to generate the clear header", async () => {
    mockGetSessionIdFromRequest.mockReturnValue(null);

    const req = makeLogoutRequest();
    await POST(req);

    expect(mockBuildClearSessionCookie).toHaveBeenCalled();
  });
});
