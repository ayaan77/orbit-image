import { NextResponse } from "next/server";
import { isAdmin, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { corsHeaders } from "@/lib/middleware/cors";
import { authenticateRequest } from "@/lib/middleware/auth";
import {
  createMcpToken,
  listMcpTokens,
  updateMcpToken,
  revokeMcpToken,
  deleteMcpToken,
} from "@/lib/auth/mcp-tokens";

export async function GET(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  try {
    const result = await listMcpTokens({ limit, offset });
    return NextResponse.json({ success: true, ...result }, { headers });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list tokens" } },
      { status: 500, headers },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  const authResult = await authenticateRequest(request);

  if (authResult.type === "error") return unauthorizedResponse(headers);
  if (authResult.type === "client") return unauthorizedResponse(headers);

  // Determine the creator
  const createdBy = authResult.type === "user" ? authResult.user.id : "master";
  if (authResult.type === "user" && authResult.user.role !== "admin") {
    return unauthorizedResponse(headers);
  }

  try {
    const body = await request.json();
    const { name, rateLimit, scopes, monthlyBudgetUsd } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "Token name is required" } },
        { status: 400, headers },
      );
    }

    const { rawKey, token } = await createMcpToken(name, createdBy, {
      rateLimit,
      scopes,
      monthlyBudgetUsd,
    });

    // Build the MCP URL for easy sharing
    const mcpUrl = `${new URL(request.url).origin}/api/mcp?token=${rawKey}`;

    return NextResponse.json(
      {
        success: true,
        apiKey: rawKey,
        mcpUrl,
        token,
      },
      { status: 201, headers },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create token" } },
      { status: 500, headers },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  try {
    const body = await request.json();
    const { tokenId, ...updates } = body;

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "tokenId is required" } },
        { status: 400, headers },
      );
    }

    const token = await updateMcpToken(tokenId, updates);
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Token not found" } },
        { status: 404, headers },
      );
    }

    return NextResponse.json({ success: true, token }, { headers });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update token" } },
      { status: 500, headers },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const headers = corsHeaders(request);
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  try {
    const body = await request.json();
    const { tokenId, permanent } = body;

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_REQUEST", message: "tokenId is required" } },
        { status: 400, headers },
      );
    }

    const success = permanent
      ? await deleteMcpToken(tokenId)
      : await revokeMcpToken(tokenId);

    if (!success) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Token not found" } },
        { status: 404, headers },
      );
    }

    return NextResponse.json(
      { success: true, message: permanent ? "Token deleted" : "Token revoked" },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete token" } },
      { status: 500, headers },
    );
  }
}
