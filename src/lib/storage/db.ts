import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cachedDb: NeonQueryFunction<false, false> | null = null;

/**
 * Returns a cached Neon SQL query function (singleton).
 * Returns null if POSTGRES_URL is not configured (graceful degradation).
 */
export function getDb() {
  if (cachedDb) return cachedDb;

  const url = process.env.POSTGRES_URL;
  if (!url) return null;

  cachedDb = neon(url);
  return cachedDb;
}

/** Reset cached db (for tests). */
export function resetDbCache(): void {
  cachedDb = null;
}
