import { timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/config/env";
import type { ErrorResponse } from "@/types/api";
import { NextResponse } from "next/server";

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Run comparison anyway to avoid length-based timing leak
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function authenticateRequest(
  request: Request
): NextResponse<ErrorResponse> | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing Authorization header",
        },
      },
      { status: 401 }
    );
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!safeCompare(token, getEnv().API_SECRET_KEY)) {
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        },
      },
      { status: 401 }
    );
  }

  return null; // authenticated
}
