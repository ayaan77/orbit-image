import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { createApiKey, revokeApiKey, listClients } from "@/lib/auth/keys";

/**
 * Admin key management — protected by master key only.
 */

// POST /api/admin/keys — Create a new client API key
export async function POST(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  let body: {
    clientName?: string;
    rateLimit?: number;
    scopes?: string[];
    defaultWebhookUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400, headers }
    );
  }

  if (!body.clientName || typeof body.clientName !== "string" || body.clientName.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "clientName is required" } },
      { status: 400, headers }
    );
  }

  // Validate optional fields
  if (body.rateLimit !== undefined && (typeof body.rateLimit !== "number" || body.rateLimit < 1)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "rateLimit must be a positive number" } },
      { status: 400, headers }
    );
  }

  if (body.defaultWebhookUrl !== undefined && !body.defaultWebhookUrl.startsWith("https://")) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "defaultWebhookUrl must use HTTPS" } },
      { status: 400, headers }
    );
  }

  try {
    const { rawKey, client } = await createApiKey(body.clientName.trim(), {
      rateLimit: body.rateLimit,
      scopes: body.scopes,
      defaultWebhookUrl: body.defaultWebhookUrl,
    });

    return NextResponse.json(
      { success: true, apiKey: rawKey, client },
      { headers },
    );
  } catch (error) {
    console.error("[admin/keys] Create error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create API key. Is KV configured?" } },
      { status: 500, headers }
    );
  }
}

// GET /api/admin/keys — List all clients
export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  try {
    const clients = await listClients();

    return NextResponse.json(
      { success: true, clients },
      { headers },
    );
  } catch (error) {
    console.error("[admin/keys] List error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list clients" } },
      { status: 500, headers }
    );
  }
}

// DELETE /api/admin/keys — Revoke a client key by clientId
export async function DELETE(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  let body: { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400, headers }
    );
  }

  if (!body.clientId || typeof body.clientId !== "string") {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "clientId is required" } },
      { status: 400, headers }
    );
  }

  try {
    const revoked = await revokeApiKey(body.clientId);

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404, headers }
      );
    }

    return NextResponse.json(
      { success: true, message: "Key revoked" },
      { headers },
    );
  } catch (error) {
    console.error("[admin/keys] Revoke error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to revoke key" } },
      { status: 500, headers }
    );
  }
}
