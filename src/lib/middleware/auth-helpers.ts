import { NextResponse } from "next/server";
import type { ErrorResponse } from "@/types/api";
import type { AuthResult } from "@/lib/auth/types";

/**
 * Convert an AuthResult error to a NextResponse (for REST routes).
 * Returns null if auth succeeded.
 */
export function authResultToResponse(
  result: AuthResult
): NextResponse<ErrorResponse> | null {
  if (result.type === "master" || result.type === "client") {
    return null;
  }

  return NextResponse.json(
    {
      success: false as const,
      error: {
        code: result.code,
        message: result.message,
      },
    },
    { status: 401 }
  );
}
