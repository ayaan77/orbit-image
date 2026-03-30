import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/users";
import { createSession, buildSessionCookie, cleanExpiredSessions } from "@/lib/auth/sessions";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "Username and password are required" } },
        { status: 400 },
      );
    }

    const user = await verifyPassword(username, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid username or password" } },
        { status: 401 },
      );
    }

    // Create session and set cookie
    const sessionId = await createSession(user.id);
    const cookie = buildSessionCookie(sessionId);

    // Clean expired sessions in the background (non-blocking)
    cleanExpiredSessions().catch(() => {});

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 200,
        headers: { "Set-Cookie": cookie },
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Login failed" } },
      { status: 500 },
    );
  }
}
