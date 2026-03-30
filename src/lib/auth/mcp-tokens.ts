import { randomBytes } from "crypto";
import { getDb } from "@/lib/storage/db";
import { generateApiKey, hashApiKey, isValidKeyFormat } from "./keys";
import type { McpToken } from "./types";

// ─── Helpers ───

function rowToToken(row: Record<string, unknown>): McpToken {
  return {
    id: row.id as string,
    name: row.name as string,
    createdBy: row.created_by as string,
    active: row.active as boolean,
    rateLimit: row.rate_limit != null ? Number(row.rate_limit) : undefined,
    scopes: row.scopes as string[] | undefined,
    defaultWebhookUrl: (row.default_webhook_url as string) || undefined,
    monthlyBudgetUsd: row.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : undefined,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

// ─── MCP Token CRUD ───

/**
 * Create a new MCP token. Returns the raw key (shown once to the admin).
 */
export async function createMcpToken(
  name: string,
  createdBy: string,
  opts?: {
    readonly rateLimit?: number;
    readonly scopes?: readonly string[];
    readonly monthlyBudgetUsd?: number;
  },
): Promise<{ rawKey: string; token: McpToken }> {
  const db = getDb();
  if (!db) throw new Error("Database not configured. Set POSTGRES_URL.");

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const id = randomBytes(8).toString("hex");

  const scopesArray = opts?.scopes ? [...opts.scopes] : null;

  const rows = await db`
    INSERT INTO mcp_tokens (id, key_hash, name, created_by, rate_limit, scopes, monthly_budget_usd)
    VALUES (${id}, ${keyHash}, ${name}, ${createdBy}, ${opts?.rateLimit ?? null}, ${scopesArray}, ${opts?.monthlyBudgetUsd ?? null})
    RETURNING *
  `;

  return { rawKey, token: rowToToken(rows[0]) };
}

/**
 * Look up an MCP token by raw key. Returns null if not found or inactive.
 */
export async function lookupMcpToken(rawKey: string): Promise<McpToken | null> {
  if (!isValidKeyFormat(rawKey)) return null;

  const db = getDb();
  if (!db) return null;

  const keyHash = hashApiKey(rawKey);
  const rows = await db`
    SELECT * FROM mcp_tokens WHERE key_hash = ${keyHash} LIMIT 1
  `;

  if (rows.length === 0) return null;

  const token = rowToToken(rows[0]);
  return token.active ? token : null;
}

/**
 * Revoke an MCP token (soft delete).
 */
export async function revokeMcpToken(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const rows = await db`
    UPDATE mcp_tokens SET active = FALSE WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Permanently delete an MCP token.
 */
export async function deleteMcpToken(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const rows = await db`DELETE FROM mcp_tokens WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

/**
 * Update an MCP token's settings.
 */
export async function updateMcpToken(
  id: string,
  updates: {
    readonly name?: string;
    readonly active?: boolean;
    readonly rateLimit?: number | null;
    readonly scopes?: readonly string[] | null;
    readonly defaultWebhookUrl?: string | null;
    readonly monthlyBudgetUsd?: number | null;
  },
): Promise<McpToken | null> {
  const db = getDb();
  if (!db) return null;

  // Build update fields — using tagged template for safety
  const current = await db`SELECT * FROM mcp_tokens WHERE id = ${id} LIMIT 1`;
  if (current.length === 0) return null;

  const row = current[0];
  const newName = updates.name ?? row.name;
  const newActive = updates.active ?? row.active;
  const newRateLimit = updates.rateLimit !== undefined ? updates.rateLimit : row.rate_limit;
  const newScopes = updates.scopes !== undefined
    ? (updates.scopes ? [...updates.scopes] : null)
    : row.scopes;
  const newWebhook = updates.defaultWebhookUrl !== undefined ? updates.defaultWebhookUrl : row.default_webhook_url;
  const newBudget = updates.monthlyBudgetUsd !== undefined ? updates.monthlyBudgetUsd : row.monthly_budget_usd;

  const rows = await db`
    UPDATE mcp_tokens
    SET name = ${newName}, active = ${newActive}, rate_limit = ${newRateLimit},
        scopes = ${newScopes}, default_webhook_url = ${newWebhook}, monthly_budget_usd = ${newBudget}
    WHERE id = ${id}
    RETURNING *
  `;

  return rows.length > 0 ? rowToToken(rows[0]) : null;
}

/**
 * List MCP tokens, optionally filtered by creator.
 */
export async function listMcpTokens(
  opts?: {
    readonly createdBy?: string;
    readonly limit?: number;
    readonly offset?: number;
  },
): Promise<{ tokens: McpToken[]; total: number }> {
  const db = getDb();
  if (!db) return { tokens: [], total: 0 };

  const limit = Math.min(opts?.limit ?? 100, 500);
  const offset = opts?.offset ?? 0;

  if (opts?.createdBy) {
    const [countResult, rows] = await Promise.all([
      db`SELECT COUNT(*)::int AS total FROM mcp_tokens WHERE created_by = ${opts.createdBy}`,
      db`SELECT * FROM mcp_tokens WHERE created_by = ${opts.createdBy} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    ]);
    return { tokens: rows.map(rowToToken), total: countResult[0].total as number };
  }

  const [countResult, rows] = await Promise.all([
    db`SELECT COUNT(*)::int AS total FROM mcp_tokens`,
    db`SELECT * FROM mcp_tokens ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
  ]);
  return { tokens: rows.map(rowToToken), total: countResult[0].total as number };
}
