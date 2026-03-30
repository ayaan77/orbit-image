import { NextResponse } from "next/server";
import { getSession, getSessionIdFromRequest } from "@/lib/auth/sessions";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";

export async function GET(request: Request): Promise<NextResponse> {
  // Rate limit: 60 requests per minute per IP
  const limited = checkIpRateLimit(request, 60, 60_000, "auth-me");
  if (limited) return limited;

  const sessionId = getSessionIdFromRequest(request);

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Not logged in" } },
      { status: 401 },
    );
  }

  const user = await getSession(sessionId);

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Session expired" } },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}
