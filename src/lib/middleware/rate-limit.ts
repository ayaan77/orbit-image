import { createHash, randomBytes } from "crypto";
import { getEnv } from "@/lib/config/env";
import { getKv } from "@/lib/storage/kv";
import type { ErrorResponse } from "@/types/api";
import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const REDIS_KEY_PREFIX = "oimg:rl:";
const REDIS_TTL_MS = 120_000; // 2x window for safety

// ─── In-memory fallback (when Redis unavailable) ───

interface WindowEntry {
  readonly timestamps: number[];
}

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

// ─── Redis sliding window ───

async function redisCheckRateLimit(
  clientKey: string,
  limit: number,
): Promise<{ limited: boolean; count: number; resetAt: number }> {
  const kv = getKv();
  if (!kv) {
    return { limited: false, count: 0, resetAt: 0 };
  }

  const now = Date.now();
  const redisKey = `${REDIS_KEY_PREFIX}${clientKey}`;
  const member = `${now}:${randomBytes(4).toString("hex")}`;

  const pipeline = kv.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, now - WINDOW_MS);
  pipeline.zadd(redisKey, { score: now, member });
  pipeline.zcard(redisKey);
  pipeline.pexpire(redisKey, REDIS_TTL_MS);

  const results = await pipeline.exec();
  const count = (results[2] as number) ?? 0;
  const resetAt = Math.ceil((now + WINDOW_MS) / 1000);

  return {
    limited: count > limit,
    count,
    resetAt,
  };
}

// ─── In-memory fallback ───

function inMemoryCheckRateLimit(
  clientKey: string,
  limit: number,
): { limited: boolean; count: number; resetAt: number } {
  const now = Date.now();

  cleanupOldEntries();

  const entry = windows.get(clientKey) ?? { timestamps: [] };
  const recentTimestamps = entry.timestamps.filter(
    (t) => now - t < WINDOW_MS,
  );

  if (recentTimestamps.length >= limit) {
    const oldestInWindow = recentTimestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    const resetAt = Math.ceil((now + retryAfterMs) / 1000);
    return { limited: true, count: recentTimestamps.length, resetAt };
  }

  recentTimestamps.push(now);
  windows.set(clientKey, { timestamps: recentTimestamps });

  const resetAt = Math.ceil((now + WINDOW_MS) / 1000);
  return { limited: false, count: recentTimestamps.length, resetAt };
}

/**
 * Check rate limit for a request.
 * Uses Redis sliding window when available, falls back to in-memory.
 * @param request - The incoming request
 * @param clientRateLimit - Optional per-client rate limit (overrides global)
 * @returns NextResponse with 429 if limited, null if within limit.
 */
export async function checkRateLimit(
  request: Request,
  clientRateLimit?: number,
): Promise<NextResponse<ErrorResponse> | null> {
  const limit = clientRateLimit ?? getEnv().RATE_LIMIT_PER_MINUTE;
  const clientKey = extractClientKey(request);

  let result: { limited: boolean; count: number; resetAt: number };

  try {
    result = await redisCheckRateLimit(clientKey, limit);
    // If Redis returned count 0 (not configured), fall back to in-memory
    if (result.count === 0 && result.resetAt === 0) {
      result = inMemoryCheckRateLimit(clientKey, limit);
    }
  } catch {
    // Redis error — fall back to in-memory
    result = inMemoryCheckRateLimit(clientKey, limit);
  }

  if (result.limited) {
    const remaining = 0;
    const retryAfterSec = Math.max(1, result.resetAt - Math.ceil(Date.now() / 1000));

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
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(result.resetAt),
        },
      },
    );
  }

  return null;
}

/**
 * Get rate limit headers for successful responses.
 * Uses Redis count when available, falls back to in-memory.
 */
export async function getRateLimitHeaders(
  request: Request,
  clientRateLimit?: number,
): Promise<Record<string, string>> {
  const limit = clientRateLimit ?? getEnv().RATE_LIMIT_PER_MINUTE;
  const clientKey = extractClientKey(request);
  const now = Date.now();

  let count = 0;

  try {
    const kv = getKv();
    if (kv) {
      const redisKey = `${REDIS_KEY_PREFIX}${clientKey}`;
      count = (await kv.zcard(redisKey)) ?? 0;
    }
  } catch {
    // Fall back to in-memory count
  }

  if (count === 0) {
    const entry = windows.get(clientKey) ?? { timestamps: [] };
    count = entry.timestamps.filter((t) => now - t < WINDOW_MS).length;
  }

  const remaining = Math.max(0, limit - count);
  const resetAt = Math.ceil((now + WINDOW_MS) / 1000);

  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetAt),
    Vary: "Authorization",
  };
}

/** Reset in-memory state (for tests). */
export function resetRateLimitState(): void {
  windows.clear();
}
