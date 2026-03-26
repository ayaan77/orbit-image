import { createHash, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/config/env";
import { hashApiKey, lookupApiKey } from "@/lib/auth/keys";
import type { AuthResult } from "@/lib/auth/types";

function safeCompare(a: string, b: string): boolean {
  // Hash both sides to fixed-length digests — eliminates length-based timing leak
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

/**
 * Authenticate a request. Checks master key first (sync), then Redis.
 * Returns AuthResult — callers decide how to handle errors.
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return { type: "error", code: "UNAUTHORIZED", message: "Missing Authorization header" };
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Fast path: check master key (sync, no Redis)
  if (safeCompare(token, getEnv().API_SECRET_KEY)) {
    return { type: "master" };
  }

  // Slow path: look up client key in Redis
  try {
    const keyHash = hashApiKey(token);
    const client = await lookupApiKey(keyHash);

    if (!client) {
      return { type: "error", code: "UNAUTHORIZED", message: "Invalid API key" };
    }

    if (!client.active) {
      return { type: "error", code: "UNAUTHORIZED", message: "API key has been revoked" };
    }

    return { type: "client", client };
  } catch {
    // KV unavailable — fall back to master-key-only mode
    return { type: "error", code: "UNAUTHORIZED", message: "Invalid API key" };
  }
}
