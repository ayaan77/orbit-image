import { neon } from "@neondatabase/serverless";

/**
 * Returns a Neon SQL query function.
 * Returns null if POSTGRES_URL is not configured (graceful degradation).
 */
export function getDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;

  return neon(url);
}
