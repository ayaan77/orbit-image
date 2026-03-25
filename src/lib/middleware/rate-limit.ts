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

  // Take only the leftmost (client) IP from a potentially multi-hop header
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

  // Hard cap on map size
  while (windows.size > MAX_ENTRIES) {
    const firstKey = windows.keys().next().value;
    if (firstKey !== undefined) windows.delete(firstKey);
    else break;
  }
}

export function checkRateLimit(
  request: Request
): NextResponse<ErrorResponse> | null {
  const limit = getEnv().RATE_LIMIT_PER_MINUTE;
  const now = Date.now();
  const key = extractClientKey(request);

  // Deterministic cleanup on every request
  cleanupOldEntries();

  const entry = windows.get(key) ?? { timestamps: [] };
  const recentTimestamps = entry.timestamps.filter(
    (t) => now - t < WINDOW_MS
  );

  if (recentTimestamps.length >= limit) {
    const oldestInWindow = recentTimestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

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
      }
    );
  }

  recentTimestamps.push(now);
  windows.set(key, { timestamps: recentTimestamps });

  return null; // within limit
}
