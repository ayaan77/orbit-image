import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpServer, type McpRequestContext } from "@/lib/mcp/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createLogger } from "@/lib/logging/logger";
import { logUsage } from "@/lib/usage/logger";
import { estimateCost } from "@/lib/usage/cost";
import { after } from "next/server";

export const maxDuration = 60;

const logger = createLogger({ module: "mcp-transport" });

// ─── Helpers ───

/**
 * Extract bearer token from Authorization header or ?token= query param.
 * Returns a new Request with the Authorization header set if token was in URL.
 */
function extractAuth(incoming: Request): Request {
  const url = new URL(incoming.url);
  const tokenParam = url.searchParams.get("token");

  if (tokenParam && !incoming.headers.get("authorization")) {
    // Redact token from URL for logging safety
    const newHeaders = new Headers(incoming.headers);
    newHeaders.set("Authorization", `Bearer ${tokenParam}`);
    return new Request(incoming, { headers: newHeaders });
  }

  return incoming;
}

/**
 * Authenticate and build MCP AuthInfo for the SDK transport.
 * We extend AuthInfo with our custom McpRequestContext fields.
 * Returns the authInfo or a Response (error) if auth/rate-limit fails.
 */
async function buildAuthContext(
  request: Request,
): Promise<{ authInfo: AuthInfo & McpRequestContext } | { error: Response }> {
  const authResult = await authenticateRequest(request);

  if (authResult.type === "error") {
    return {
      error: new Response(JSON.stringify({ error: authResult.message }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      }),
    };
  }

  const clientRateLimit =
    authResult.type === "client" ? authResult.client.rateLimit : undefined;
  const rateLimitError = await checkRateLimit(request, clientRateLimit);
  if (rateLimitError) {
    return {
      error: new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...corsHeaders(request) },
      }),
    };
  }

  const clientId =
    authResult.type === "client"
      ? authResult.client.clientId
      : authResult.type === "user"
        ? authResult.user.id
        : "master";
  const clientName =
    authResult.type === "client"
      ? authResult.client.clientName
      : authResult.type === "user"
        ? authResult.user.username
        : "master";

  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const scopes =
    authResult.type === "client" && authResult.client.scopes
      ? [...authResult.client.scopes]
      : [];

  const authInfo: AuthInfo & McpRequestContext = {
    // AuthInfo fields (required by SDK)
    token,
    clientId,
    scopes,
    // McpRequestContext fields (used by tool callbacks)
    clientName,
    rateLimit: clientRateLimit,
    onUsage: (meta) => {
      after(
        logUsage({
          clientId,
          clientName,
          brand: meta.brand,
          purpose: meta.purpose,
          style: meta.style,
          imageCount: meta.imageCount,
          quality: meta.quality,
          estimatedCostUsd: estimateCost(meta.imageCount, meta.quality),
          processingTimeMs: meta.processingTimeMs,
          cached: false,
          endpoint: "mcp",
          timestamp: new Date(),
        }),
      );
    },
  };

  return { authInfo };
}

/**
 * Merge CORS headers into a Response.
 */
function withCors(response: Response, request: Request): Response {
  const cors = corsHeaders(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ─── Route Handlers ───

/** CORS preflight */
export async function OPTIONS(request: Request): Promise<Response> {
  const preflight = handlePreflight(request);
  if (preflight) return preflight;
  return new Response(null, { status: 204 });
}

/**
 * POST /api/mcp — Streamable HTTP transport for MCP.
 * Handles initialize, tools/list, tools/call, and notifications.
 * Stateless mode: each request creates a fresh server + transport.
 */
export async function POST(incomingRequest: Request): Promise<Response> {
  const request = extractAuth(incomingRequest);

  try {
    // Authenticate
    const authOrError = await buildAuthContext(request);
    if ("error" in authOrError) {
      return withCors(authOrError.error, request);
    }

    // Create per-request server and transport (stateless mode)
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true, // prefer JSON over SSE for serverless
    });

    // Connect server to transport
    await server.connect(transport);

    // Let the transport handle the request, passing auth context
    const response = await transport.handleRequest(request, {
      authInfo: authOrError.authInfo,
    });

    // Clean up after response is sent
    after(async () => {
      try {
        await server.close();
      } catch {
        // Ignore close errors
      }
    });

    return withCors(response, request);
  } catch (error) {
    logger.error("MCP transport error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return withCors(
      new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
      request,
    );
  }
}

/**
 * GET /api/mcp — SSE stream for server-initiated notifications.
 * In stateless mode, this returns 405 since there's no session to stream to.
 */
export async function GET(request: Request): Promise<Response> {
  return withCors(
    new Response(
      JSON.stringify({
        error: "SSE not supported in stateless mode. Use POST for all MCP requests.",
      }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    ),
    request,
  );
}

/**
 * DELETE /api/mcp — Session teardown.
 * In stateless mode, this is a no-op.
 */
export async function DELETE(request: Request): Promise<Response> {
  return withCors(
    new Response(null, { status: 204 }),
    request,
  );
}
