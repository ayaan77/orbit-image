import { randomBytes, createHash } from "crypto";
import { getKv } from "@/lib/storage/kv";
import type { ClientInfo } from "./types";

const KEY_PREFIX = "oimg_live_";
const REDIS_KEY_PREFIX = "oimg:keys:";
const REDIS_CLIENTS_SET = "oimg:clients";

// ─── Key Generation ───

export function generateApiKey(): string {
  const random = randomBytes(16).toString("hex"); // 32 hex chars
  return `${KEY_PREFIX}${random}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function isValidKeyFormat(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length === 42;
}

// ─── Redis Operations ───

function redisKey(hash: string): string {
  return `${REDIS_KEY_PREFIX}${hash}`;
}

/**
 * Look up a client by their API key hash.
 * Returns null if KV is not configured or key not found.
 */
export async function lookupApiKey(
  keyHash: string
): Promise<ClientInfo | null> {
  const kv = getKv();
  if (!kv) return null;

  const data = await kv.get<ClientInfo>(redisKey(keyHash));
  return data ?? null;
}

/**
 * Create a new client API key. Returns the raw key (shown once).
 * Stores only the hash in Redis.
 */
export async function createApiKey(
  clientName: string,
  opts?: {
    readonly rateLimit?: number;
    readonly scopes?: readonly string[];
    readonly defaultWebhookUrl?: string;
    readonly monthlyBudgetUsd?: number;
    readonly email?: string;
    readonly source?: "admin" | "studio";
  },
): Promise<{ rawKey: string; client: ClientInfo }> {
  const kv = getKv();
  if (!kv) {
    throw new Error("KV storage not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
  }

  const rawKey = generateApiKey();
  const hash = hashApiKey(rawKey);
  const clientId = randomBytes(8).toString("hex");

  const client: ClientInfo = {
    clientId,
    clientName,
    createdAt: new Date().toISOString(),
    active: true,
    ...(opts?.rateLimit !== undefined && { rateLimit: opts.rateLimit }),
    ...(opts?.scopes !== undefined && { scopes: opts.scopes }),
    ...(opts?.defaultWebhookUrl !== undefined && { defaultWebhookUrl: opts.defaultWebhookUrl }),
    ...(opts?.monthlyBudgetUsd !== undefined && { monthlyBudgetUsd: opts.monthlyBudgetUsd }),
    ...(opts?.email !== undefined && { email: opts.email }),
    ...(opts?.source !== undefined && { source: opts.source }),
  };

  // Store key hash → client info
  await kv.set(redisKey(hash), client);

  // Add to client set for listing (clientId → hash mapping)
  await kv.hset(REDIS_CLIENTS_SET, { [clientId]: hash });

  return { rawKey, client };
}

/**
 * Revoke a client's API key by clientId.
 * Sets active: false so lookups fail auth.
 */
export async function revokeApiKey(clientId: string): Promise<boolean> {
  const kv = getKv();
  if (!kv) return false;

  // Get the hash for this clientId
  const hash = await kv.hget<string>(REDIS_CLIENTS_SET, clientId);
  if (!hash) return false;

  // Get current client info
  const client = await kv.get<ClientInfo>(redisKey(hash));
  if (!client) return false;

  // Set inactive
  await kv.set(redisKey(hash), { ...client, active: false });
  return true;
}

/**
 * Merge a nullable optional field: use the new value if provided (null/empty removes it),
 * otherwise keep the existing value, otherwise omit.
 */
function mergeOptional<T>(
  incoming: T | null | undefined,
  existing: T | undefined,
  isEmpty: (v: T) => boolean = () => false,
): { [k: string]: T } | Record<string, never> {
  if (incoming !== undefined) {
    return incoming !== null && !isEmpty(incoming) ? { value: incoming } : {};
  }
  return existing !== undefined ? { value: existing } : {};
}

/**
 * Update mutable fields on an existing client.
 * Pass `defaultWebhookUrl: ""` or `null` to remove it.
 * Pass `active: true` to restore a revoked key.
 */
export async function updateClientInfo(
  clientId: string,
  updates: {
    readonly rateLimit?: number;
    readonly scopes?: readonly string[];
    readonly defaultWebhookUrl?: string | null;
    readonly active?: boolean;
    readonly monthlyBudgetUsd?: number | null;
  },
): Promise<ClientInfo | null> {
  const kv = getKv();
  if (!kv) return null;

  const hash = await kv.hget<string>(REDIS_CLIENTS_SET, clientId);
  if (!hash) return null;

  const client = await kv.get<ClientInfo>(redisKey(hash));
  if (!client) return null;

  const rateLimitField = mergeOptional(updates.rateLimit, client.rateLimit);
  const scopesField = mergeOptional(updates.scopes, client.scopes);
  const webhookField = mergeOptional(updates.defaultWebhookUrl, client.defaultWebhookUrl, (v) => v === "");
  const budgetField = mergeOptional(updates.monthlyBudgetUsd, client.monthlyBudgetUsd, (v) => v <= 0);

  const updated: ClientInfo = {
    clientId: client.clientId,
    clientName: client.clientName,
    createdAt: client.createdAt,
    active: updates.active !== undefined ? updates.active : client.active,
    ...(rateLimitField.value !== undefined && { rateLimit: rateLimitField.value }),
    ...(scopesField.value !== undefined && { scopes: scopesField.value }),
    ...(webhookField.value !== undefined && { defaultWebhookUrl: webhookField.value }),
    ...(budgetField.value !== undefined && { monthlyBudgetUsd: budgetField.value }),
  };

  await kv.set(redisKey(hash), updated);
  return updated;
}

/**
 * Permanently delete a client — removes both the key hash entry
 * and the clientId→hash mapping from Redis.
 */
export async function deleteClient(clientId: string): Promise<boolean> {
  const kv = getKv();
  if (!kv) return false;

  const hash = await kv.hget<string>(REDIS_CLIENTS_SET, clientId);
  if (!hash) return false;

  await Promise.all([
    kv.del(redisKey(hash)),
    kv.hdel(REDIS_CLIENTS_SET, clientId),
  ]);
  return true;
}

/**
 * List registered clients (without raw keys).
 * @param limit  Max clients to return (default 100, max 500).
 * @param offset Number of clients to skip for pagination.
 */
export async function listClients(
  limit = 100,
  offset = 0,
): Promise<{ clients: ClientInfo[]; total: number }> {
  const kv = getKv();
  if (!kv) return { clients: [], total: 0 };

  const mapping = await kv.hgetall<Record<string, string>>(REDIS_CLIENTS_SET);
  if (!mapping) return { clients: [], total: 0 };

  const allHashes = Object.values(mapping);
  const total = allHashes.length;
  const pageHashes = allHashes.slice(offset, offset + Math.min(limit, 500));

  const results = await Promise.all(
    pageHashes.map((hash) => kv.get<ClientInfo>(redisKey(hash))),
  );

  return {
    clients: results.filter((c): c is ClientInfo => c !== null),
    total,
  };
}
