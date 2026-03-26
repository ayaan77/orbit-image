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
 * List all registered clients (without raw keys).
 */
export async function listClients(): Promise<ClientInfo[]> {
  const kv = getKv();
  if (!kv) return [];

  // Get all clientId → hash mappings
  const mapping = await kv.hgetall<Record<string, string>>(REDIS_CLIENTS_SET);
  if (!mapping) return [];

  const hashes = Object.values(mapping);
  const results = await Promise.all(
    hashes.map((hash) => kv.get<ClientInfo>(redisKey(hash))),
  );

  return results.filter((c): c is ClientInfo => c !== null);
}
