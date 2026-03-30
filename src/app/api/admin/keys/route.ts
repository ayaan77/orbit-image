import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { createApiKey, revokeApiKey, listClients, updateClientInfo, deleteClient } from "@/lib/auth/keys";
import { isPublicHttpsUrl } from "@/lib/validation/webhook-url";
import { createLogger } from "@/lib/logging/logger";

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

  if (body.defaultWebhookUrl !== undefined && !isPublicHttpsUrl(body.defaultWebhookUrl)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "defaultWebhookUrl must be a public HTTPS endpoint" } },
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
    createLogger({ module: "admin-keys" }).error("Create API key failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create API key. Is KV configured?" } },
      { status: 500, headers }
    );
  }
}

// GET /api/admin/keys — List clients (supports ?limit=&cursor= for cursor-based pagination)
export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const cursor = url.searchParams.get("cursor") ?? "0";

  try {
    const { clients, total, nextCursor } = await listClients(limit, cursor);

    return NextResponse.json(
      { success: true, clients, total, limit, cursor, nextCursor },
      { headers },
    );
  } catch (error) {
    createLogger({ module: "admin-keys" }).error("List clients error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list clients" } },
      { status: 500, headers }
    );
  }
}

// PATCH /api/admin/keys — Update settings for an existing client (webhook, rate limit, scopes, restore)
export async function PATCH(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  let body: {
    clientId?: string;
    rateLimit?: number;
    scopes?: string[];
    defaultWebhookUrl?: string | null;
    active?: boolean;
    monthlyBudgetUsd?: number | null;
  };
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

  if (body.rateLimit !== undefined && (typeof body.rateLimit !== "number" || body.rateLimit < 1)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "rateLimit must be a positive number" } },
      { status: 400, headers }
    );
  }

  if (body.monthlyBudgetUsd !== undefined && body.monthlyBudgetUsd !== null && (typeof body.monthlyBudgetUsd !== "number" || body.monthlyBudgetUsd <= 0)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "monthlyBudgetUsd must be a positive number" } },
      { status: 400, headers }
    );
  }

  if (
    body.defaultWebhookUrl !== undefined &&
    body.defaultWebhookUrl !== null &&
    body.defaultWebhookUrl !== "" &&
    !isPublicHttpsUrl(body.defaultWebhookUrl)
  ) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "defaultWebhookUrl must be a public HTTPS endpoint" } },
      { status: 400, headers }
    );
  }

  try {
    const updated = await updateClientInfo(body.clientId, {
      ...(body.rateLimit !== undefined && { rateLimit: body.rateLimit }),
      ...(body.scopes !== undefined && { scopes: body.scopes }),
      ...(body.defaultWebhookUrl !== undefined && { defaultWebhookUrl: body.defaultWebhookUrl }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.monthlyBudgetUsd !== undefined && { monthlyBudgetUsd: body.monthlyBudgetUsd }),
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404, headers }
      );
    }

    return NextResponse.json({ success: true, client: updated }, { headers });
  } catch (error) {
    createLogger({ module: "admin-keys" }).error("Update client failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update client" } },
      { status: 500, headers }
    );
  }
}

// DELETE /api/admin/keys — Revoke (soft) or permanently delete a client key
// Body: { clientId: string, permanent?: boolean }
export async function DELETE(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  let body: { clientId?: string; permanent?: boolean };
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
    if (body.permanent) {
      const deleted = await deleteClient(body.clientId);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
          { status: 404, headers }
        );
      }
      return NextResponse.json({ success: true, message: "Client permanently deleted" }, { headers });
    }

    const revoked = await revokeApiKey(body.clientId);
    if (!revoked) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404, headers }
      );
    }
    return NextResponse.json({ success: true, message: "Key revoked" }, { headers });
  } catch (error) {
    createLogger({ module: "admin-keys" }).error("Delete/revoke client failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete key" } },
      { status: 500, headers }
    );
  }
}
