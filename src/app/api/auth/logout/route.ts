import { NextResponse } from "next/server";
import { deleteSession, getSessionIdFromRequest, buildClearSessionCookie } from "@/lib/auth/sessions";

export async function POST(request: Request): Promise<NextResponse> {
  const sessionId = getSessionIdFromRequest(request);

  if (sessionId) {
    await deleteSession(sessionId);
  }

  return NextResponse.json(
    { success: true },
    {
      status: 200,
      headers: { "Set-Cookie": buildClearSessionCookie() },
    },
  );
}
