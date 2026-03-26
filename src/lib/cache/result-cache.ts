import { createHash } from "crypto";
import { getKv } from "@/lib/storage/kv";
import { getEnv } from "@/lib/config/env";

const CACHE_PREFIX = "oimg:imgcache:";
const MAX_CACHE_ENTRY_BYTES = 1_048_576; // 1 MB

export interface CacheKeyParams {
  readonly topic: string;
  readonly brand: string;
  readonly purpose: string;
  readonly style?: string;
  readonly quality: string;
  readonly dimensions?: { readonly width: number; readonly height: number };
  readonly count: number;
}

export interface CachedImage {
  readonly base64: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface CachedGenerateResult {
  readonly images: readonly CachedImage[];
  readonly brand: string;
  readonly createdAt: string;
}

/**
 * Compute a deterministic cache key from request parameters.
 * Sorts keys and hashes with SHA-256 to produce a stable key.
 */
export function computeCacheKey(params: CacheKeyParams): string {
  const normalized = {
    brand: params.brand,
    count: params.count,
    dimensions: params.dimensions ?? null,
    purpose: params.purpose,
    quality: params.quality,
    style: params.style ?? null,
    topic: params.topic,
  };
  const json = JSON.stringify(normalized);
  const hash = createHash("sha256").update(json).digest("hex");
  return `${CACHE_PREFIX}${hash}`;
}

/**
 * Retrieve a cached generation result.
 * Returns null on miss or if Redis is unavailable (graceful degradation).
 */
export async function getCachedResult(
  key: string,
): Promise<CachedGenerateResult | null> {
  try {
    const kv = getKv();
    if (!kv) return null;

    const result = await kv.get<CachedGenerateResult>(key);
    return result ?? null;
  } catch (error) {
    console.warn("[result-cache] Failed to read cache:", error);
    return null;
  }
}

/**
 * Store a generation result in cache.
 * Skips silently if Redis is unavailable or payload exceeds size limit.
 */
export async function setCachedResult(
  key: string,
  result: CachedGenerateResult,
): Promise<void> {
  try {
    const kv = getKv();
    if (!kv) return;

    // Estimate payload size — skip if too large for Redis
    const payloadSize = JSON.stringify(result).length;
    if (payloadSize > MAX_CACHE_ENTRY_BYTES) {
      console.warn(
        `[result-cache] Skipping cache for key ${key}: payload ${payloadSize} bytes exceeds ${MAX_CACHE_ENTRY_BYTES} limit`,
      );
      return;
    }

    const ttl = getEnv().IMAGE_CACHE_TTL_SECONDS;
    await kv.set(key, result, { ex: ttl });
  } catch (error) {
    console.warn("[result-cache] Failed to write cache:", error);
  }
}

/**
 * Delete a single cache entry.
 */
export async function invalidateCache(key: string): Promise<boolean> {
  try {
    const kv = getKv();
    if (!kv) return false;

    const deleted = await kv.del(key);
    return deleted > 0;
  } catch (error) {
    console.warn("[result-cache] Failed to invalidate cache:", error);
    return false;
  }
}

/**
 * Flush all image cache entries.
 * Returns the number of keys deleted.
 */
export async function flushImageCache(): Promise<number> {
  try {
    const kv = getKv();
    if (!kv) return 0;

    // Scan for all image cache keys
    let cursor = 0;
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await kv.scan(cursor, {
        match: `${CACHE_PREFIX}*`,
        count: 100,
      });
      cursor = typeof nextCursor === "string" ? parseInt(nextCursor, 10) : nextCursor;

      if (keys.length > 0) {
        const pipeline = kv.pipeline();
        for (const key of keys) {
          pipeline.del(key as string);
        }
        await pipeline.exec();
        totalDeleted += keys.length;
      }
    } while (cursor !== 0);

    return totalDeleted;
  } catch (error) {
    console.warn("[result-cache] Failed to flush cache:", error);
    return 0;
  }
}
