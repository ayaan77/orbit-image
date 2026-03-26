import { createHash } from "crypto";
import { getEnv } from "@/lib/config/env";
import type { ErrorResponse } from "@/types/api";
import { NextResponse } from "next/server";

interface WindowEntry {
  readonly timestamps: number[];
}

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;
const windows = new Map<string, WindowEntry>();

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function extractClientKey(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader) return hashKey(authHeader);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return hashKey(forwarded.split(",")[0].trim());
  }

  return "anonymous";
}

function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [key, entry] of windows) {
    const recent = entry.timestamps.filter((t) => now - t < WINDOW_MS);
    if (recent.length === 0) {
      windows.delete(key);
    } else {
      windows.set(key, { timestamps: recent });
    }
  }

  while (windows.size > MAX_ENTRIES) {
    const firstKey = windows.keys().next().value;
    if (firstKey !== undefined) windows.delete(firstKey);
    else break;
  }
}

/**
 * Check rate limit for a request.
 * @param request - The incoming request
 * @param clientRateLimit - Optional per-client rate limit (overrides global)
 * @returns NextResponse with 429 if limited, null if within limit.
 *          Sets X-RateLimit-* headers on the response via the returned headers map.
 */
export function checkRateLimit(
  request: Request,
  clientRateLimit?: number,
): NextResponse<ErrorResponse> | null {
  const limit = clientRateLimit ?? getEnv().RATE_LIMIT_PER_MINUTE;
  const now = Date.now();
  const key = extractClientKey(request);

  cleanupOldEntries();

  const entry = windows.get(key) ?? { timestamps: [] };
  const recentTimestamps = entry.timestamps.filter(
    (t) => now - t < WINDOW_MS,
  );

  if (recentTimestamps.length >= limit) {
    const oldestInWindow = recentTimestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    const resetAt = Math.ceil((now + retryAfterMs) / 1000);

    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Try again in ${retryAfterSec}s.`,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetAt),
        },
      },
    );
  }

  recentTimestamps.push(now);
  windows.set(key, { timestamps: recentTimestamps });

  return null;
}

/**
 * Get rate limit headers for successful responses.
 */
export function getRateLimitHeaders(
  request: Request,
  clientRateLimit?: number,
): Record<string, string> {
  const limit = clientRateLimit ?? getEnv().RATE_LIMIT_PER_MINUTE;
  const now = Date.now();
  const key = extractClientKey(request);

  const entry = windows.get(key) ?? { timestamps: [] };
  const recentCount = entry.timestamps.filter(
    (t) => now - t < WINDOW_MS,
  ).length;
  const remaining = Math.max(0, limit - recentCount);
  const resetAt = Math.ceil((now + WINDOW_MS) / 1000);

  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetAt),
  };
}

/** Reset in-memory state (for tests). */
export function resetRateLimitState(): void {
  windows.clear();
}
