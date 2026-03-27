import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { getKv } from "@/lib/storage/kv";
import { isPublicHttpsUrl } from "@/lib/validation/webhook-url";
import { getEnv } from "@/lib/config/env";

const TEST_TIMEOUT_MS = 8_000;

/**
 * POST /api/admin/test-webhook
 * Sends a test payload to a client's configured webhook URL.
 * Requires master key. Protected against SSRF via isPublicHttpsUrl.
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

  // Look up the client
  const kv = getKv();
  if (!kv) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "KV storage not configured" } },
      { status: 503, headers },
    );
  }

  // Get hash mapping from the clients set
  const hash = await kv.hget<string>("oimg:clients", body.clientId);
  if (!hash) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
      { status: 404, headers },
    );
  }

  const client = await kv.get<{
    clientId: string;
    clientName: string;
    active: boolean;
    defaultWebhookUrl?: string;
  }>(`oimg:keys:${hash}`);

  if (!client || !client.active) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Client not found or inactive" } },
      { status: 404, headers },
    );
  }

  if (!client.defaultWebhookUrl) {
    return NextResponse.json(
      { success: false, error: { code: "NO_WEBHOOK", message: "This app has no webhook URL configured" } },
      { status: 400, headers },
    );
  }

  const webhookUrl = client.defaultWebhookUrl;

  if (!isPublicHttpsUrl(webhookUrl)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_URL", message: "Webhook URL is not a valid public HTTPS endpoint" } },
      { status: 400, headers },
    );
  }

  const env = getEnv();
  if (!env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "WEBHOOK_SECRET is not configured on the server" } },
      { status: 503, headers },
    );
  }

  // Build and sign test payload
  const payload = JSON.stringify({
    event: "test",
    timestamp: new Date().toISOString(),
    message: "This is a test webhook from Orbit Image",
    client: client.clientName,
  });

  const signature = `sha256=${createHmac("sha256", env.WEBHOOK_SECRET).update(payload).digest("hex")}`;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Orbit-Signature": signature,
        "X-Orbit-Event": "test",
      },
      body: payload,
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });

    if (response.ok) {
      return NextResponse.json(
        { success: true, statusCode: response.status, message: `Webhook responded ${response.status}` },
        { headers },
      );
    }

    return NextResponse.json(
      {
        success: false,
        statusCode: response.status,
        error: { code: "WEBHOOK_ERROR", message: `Webhook returned ${response.status}` },
      },
      { status: 200, headers }, // always 200 — let UI handle the result
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json(
      { success: false, error: { code: "DELIVERY_FAILED", message } },
      { headers },
    );
  }
}
