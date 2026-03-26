import { Redis } from "@upstash/redis";

let instance: Redis | null = null;

/**
 * Returns the Upstash Redis client singleton.
 * Returns null if KV env vars are not configured (graceful degradation).
 */
export function getKv(): Redis | null {
  if (instance) return instance;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  instance = new Redis({ url, token });
  return instance;
}

/** Reset singleton (for tests). */
export function resetKv(): void {
  instance = null;
}
