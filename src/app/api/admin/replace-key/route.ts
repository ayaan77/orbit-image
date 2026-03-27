import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { getKv } from "@/lib/storage/kv";
import { generateApiKey, hashApiKey } from "@/lib/auth/keys";
import type { ClientInfo } from "@/lib/auth/types";

/**
 * POST /api/admin/replace-key
 * Revokes the existing key for a client and issues a new one.
 * Returns the new raw key (shown once, same as creation).
 * Requires master key.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  let body: { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400, headers },
    );
  }

  if (!body.clientId || typeof body.clientId !== "string") {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "clientId is required" } },
      { status: 400, headers },
    );
  }

  const kv = getKv();
  if (!kv) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "KV storage not configured" } },
      { status: 503, headers },
    );
  }

  // Get old hash for this clientId
  const oldHash = await kv.hget<string>("oimg:clients", body.clientId);
  if (!oldHash) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
      { status: 404, headers },
    );
  }

  const client = await kv.get<ClientInfo>(`oimg:keys:${oldHash}`);
  if (!client || !client.active) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Client not found or inactive" } },
      { status: 404, headers },
    );
  }

  // Generate new key
  const newRawKey = generateApiKey();
  const newHash = hashApiKey(newRawKey);

  // Store new hash → same client info
  await kv.set(`oimg:keys:${newHash}`, client);

  // Update clientId → new hash mapping
  await kv.hset("oimg:clients", { [body.clientId]: newHash });

  // Invalidate old hash (mark inactive so it fails auth immediately)
  await kv.set(`oimg:keys:${oldHash}`, { ...client, active: false });

  return NextResponse.json(
    { success: true, apiKey: newRawKey, client },
    { headers },
  );
}
