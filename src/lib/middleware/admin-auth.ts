import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";

/**
 * Check if the request is from an admin (master key or admin user).
 */
export async function isAdmin(request: Request): Promise<boolean> {
  const result = await authenticateRequest(request);
  if (result.type === "master") return true;
  if (result.type === "user" && result.user.role === "admin") return true;
  return false;
}

/** @deprecated Use isAdmin() instead */
export function isMasterKey(request: Request): Promise<boolean> {
  return isAdmin(request);
}

/**
 * Build a 401 response for admin routes.
 */
export function unauthorizedResponse(
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Admin access required" } },
    { status: 401, headers },
  );
}
