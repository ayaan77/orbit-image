import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { ErrorResponse } from "@/types/api";

/**
 * IP-based rate limiter for public (unauthenticated) routes.
 * Uses in-memory sliding window — suitable for single-instance Vercel deployments.
 */

interface WindowEntry {
  readonly timestamps: number[];
}

const windows = new Map<string, WindowEntry>();
const MAX_ENTRIES = 5_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function hashIp(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return hashIp(forwarded.split(",")[0].trim());

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return hashIp(realIp);

  return "anonymous";
}

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (entry.timestamps.every((t) => now - t > 3_600_000)) {
      windows.delete(key);
    }
  }
  while (windows.size > MAX_ENTRIES) {
    const firstKey = windows.keys().next().value;
    if (firstKey !== undefined) windows.delete(firstKey);
    else break;
  }
}

/**
 * Check IP-based rate limit.
 * @param request   Incoming request
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds (default 1 hour)
 * @param scope     Namespace to separate different route limits
 */
export function checkIpRateLimit(
  request: Request,
  limit: number,
  windowMs = 3_600_000,
  scope = "default",
): NextResponse<ErrorResponse> | null {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS || windows.size > MAX_ENTRIES) {
    cleanup();
    lastCleanup = now;
  }

  const ip = extractIp(request);
  const key = `${scope}:${ip}`;
  const entry = windows.get(key) ?? { timestamps: [] };
  const recent = entry.timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    const oldestInWindow = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldestInWindow)) / 1000));

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
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  recent.push(now);
  windows.set(key, { timestamps: recent });
  return null;
}

/** Reset state (for tests). */
export function resetIpRateLimitState(): void {
  windows.clear();
}
