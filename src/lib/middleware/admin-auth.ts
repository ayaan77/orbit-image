import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";

/**
 * Check if the request is authenticated with the master key.
 */
export function isMasterKey(request: Request): Promise<boolean> {
  return authenticateRequest(request).then((r) => r.type === "master");
}

/**
 * Build a 401 response for admin routes requiring master key.
 */
export function unauthorizedResponse(
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Master key required" } },
    { status: 401, headers },
  );
}
