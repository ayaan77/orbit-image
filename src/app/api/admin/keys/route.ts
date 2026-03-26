import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { createApiKey, revokeApiKey, listClients } from "@/lib/auth/keys";

/**
 * Admin key management — protected by master key only.
 */

function isMasterKey(request: Request): Promise<boolean> {
  return authenticateRequest(request).then((r) => r.type === "master");
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Master key required" } },
    { status: 401 }
  );
}

// POST /api/admin/keys — Create a new client API key
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isMasterKey(request))) return unauthorized();

  let body: { clientName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  if (!body.clientName || typeof body.clientName !== "string" || body.clientName.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "clientName is required" } },
      { status: 400 }
    );
  }

  try {
    const { rawKey, client } = await createApiKey(body.clientName.trim());

    return NextResponse.json({
      success: true,
      apiKey: rawKey, // shown once — never stored or retrievable again
      client,
    });
  } catch (error) {
    console.error("[admin/keys] Create error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create API key. Is KV configured?" } },
      { status: 500 }
    );
  }
}

// GET /api/admin/keys — List all clients
export async function GET(request: Request): Promise<NextResponse> {
  if (!(await isMasterKey(request))) return unauthorized();

  try {
    const clients = await listClients();

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error) {
    console.error("[admin/keys] List error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list clients" } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/keys — Revoke a client key by clientId
export async function DELETE(request: Request): Promise<NextResponse> {
  if (!(await isMasterKey(request))) return unauthorized();

  let body: { clientId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  if (!body.clientId || typeof body.clientId !== "string") {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "clientId is required" } },
      { status: 400 }
    );
  }

  try {
    const revoked = await revokeApiKey(body.clientId);

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Key revoked" });
  } catch (error) {
    console.error("[admin/keys] Revoke error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to revoke key" } },
      { status: 500 }
    );
  }
}
