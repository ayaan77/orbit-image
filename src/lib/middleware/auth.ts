import { createHash, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/config/env";
import { hashApiKey, isValidKeyFormat, lookupApiKey } from "@/lib/auth/keys";
import { getSession, getSessionIdFromRequest } from "@/lib/auth/sessions";
import { lookupMcpToken } from "@/lib/auth/mcp-tokens";
import type { AuthResult } from "@/lib/auth/types";

function safeCompare(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

/**
 * Authenticate a request. Tries three paths in order:
 * 1. Session cookie (orbit-session) → Postgres lookup → User
 * 2. Bearer token (oimg_live_*) → Postgres MCP token or Redis legacy key
 * 3. Master key (API_SECRET_KEY) → sync compare
 */
export async function authenticateRequest(
  request: Request
): Promise<AuthResult> {
  // Path 1: Session cookie (for web UI)
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    try {
      const user = await getSession(sessionId);
      if (user) {
        return { type: "user", user };
      }
    } catch {
      // Session lookup failed — continue to other auth methods
    }
  }

  // Path 2 & 3: Authorization header (for MCP tokens, REST API, master key)
  const authHeader = request.headers.get("authorization");

  if (!authHeader && !sessionId) {
    return { type: "error", code: "UNAUTHORIZED", message: "Missing authentication" };
  }

  if (!authHeader) {
    return { type: "error", code: "UNAUTHORIZED", message: "Session expired or invalid" };
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Path 3: Check master key (sync, no DB)
  if (safeCompare(token, getEnv().API_SECRET_KEY)) {
    return { type: "master" };
  }

  // Path 2: Look up MCP token or legacy client key
  if (!isValidKeyFormat(token)) {
    return { type: "error", code: "UNAUTHORIZED", message: "Invalid API key" };
  }

  try {
    // Try Postgres MCP tokens first
    const mcpToken = await lookupMcpToken(token);
    if (mcpToken) {
      // Convert McpToken to ClientInfo shape for backward compatibility
      return {
        type: "client",
        client: {
          clientId: mcpToken.id,
          clientName: mcpToken.name,
          createdAt: mcpToken.createdAt,
          active: true,
          rateLimit: mcpToken.rateLimit,
          scopes: mcpToken.scopes,
          defaultWebhookUrl: mcpToken.defaultWebhookUrl,
          monthlyBudgetUsd: mcpToken.monthlyBudgetUsd,
        },
      };
    }

    // Fall back to legacy Redis lookup
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
    return { type: "error", code: "UNAUTHORIZED", message: "Invalid API key" };
  }
}
