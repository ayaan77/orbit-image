/**
 * Legacy MCP endpoint — raw JSON-RPC 2.0 over HTTP.
 * Preserved for backward compatibility with existing integrations.
 * New clients should use the Streamable HTTP transport at /api/mcp.
 */

import { NextResponse, after } from "next/server";
import { JsonRpcRequestSchema } from "@/types/mcp";
import type { JsonRpcResponse } from "@/types/mcp";
import { getToolDefinitions, findTool, isAuthRequired } from "@/lib/mcp/tools";
import {
  buildErrorResponse,
  buildToolsListResponse,
  PARSE_ERROR,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  AUTH_REQUIRED,
  RATE_LIMITED,
  SCOPE_DENIED,
  INTERNAL_ERROR,
} from "@/lib/mcp/errors";
import {
  handleListStyles,
  handleListPurposes,
  handleGenerateImage,
  handleListBrands,
  handleGetImage,
} from "@/lib/mcp/handlers";
import { authenticateRequest } from "@/lib/middleware/auth";
import { getEnv } from "@/lib/config/env";
import { createLogger } from "@/lib/logging/logger";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { logUsage } from "@/lib/usage/logger";
import { estimateCost } from "@/lib/usage/cost";

export const maxDuration = 60;

/** CORS preflight */
export function OPTIONS(request: Request) {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}

export async function POST(
  incomingRequest: Request
): Promise<NextResponse<JsonRpcResponse>> {
  // Support token-in-URL: ?token=oimg_live_xxx
  let request = incomingRequest;
  const url = new URL(incomingRequest.url);
  const tokenParam = url.searchParams.get("token");
  if (tokenParam && !incomingRequest.headers.get("authorization")) {
    const newHeaders = new Headers(incomingRequest.headers);
    newHeaders.set("Authorization", `Bearer ${tokenParam}`);
    request = new Request(incomingRequest, { headers: newHeaders });
  }

  const requestId = getRequestId(request);
  const deprecationHeaders = {
    ...requestIdHeaders(requestId),
    ...corsHeaders(request),
    "X-Deprecated": "Use Streamable HTTP transport at /api/mcp instead",
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      buildErrorResponse(null, PARSE_ERROR, "Invalid JSON"),
      { headers: deprecationHeaders },
    );
  }

  const parsed = JsonRpcRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      buildErrorResponse(null, INVALID_REQUEST, "Invalid JSON-RPC 2.0 request"),
      { headers: deprecationHeaders },
    );
  }

  const { id, method, params } = parsed.data;

  if (method === "tools/list") {
    return NextResponse.json(
      buildToolsListResponse(id, getToolDefinitions()),
      { headers: deprecationHeaders },
    );
  }

  if (method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name : undefined;
    const toolArgs =
      params.arguments != null && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (!toolName || !findTool(toolName)) {
      return NextResponse.json(
        buildErrorResponse(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName ?? "undefined"}`),
        { headers: deprecationHeaders },
      );
    }

    let authResult: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
    if (isAuthRequired(toolName)) {
      authResult = await authenticateRequest(request);
      if (authResult.type === "error") {
        return NextResponse.json(
          buildErrorResponse(id, AUTH_REQUIRED, "Authentication required"),
          { headers: deprecationHeaders },
        );
      }

      const clientRateLimit = authResult.type === "client" ? authResult.client.rateLimit : undefined;
      const rateLimitError = await checkRateLimit(request, clientRateLimit);
      if (rateLimitError) {
        return NextResponse.json(
          buildErrorResponse(id, RATE_LIMITED, "Rate limit exceeded"),
          { headers: deprecationHeaders },
        );
      }
    }

    try {
      switch (toolName) {
        case "list-styles":
          return NextResponse.json(handleListStyles(id), { headers: deprecationHeaders });

        case "list-purposes":
          return NextResponse.json(handleListPurposes(id), { headers: deprecationHeaders });

        case "list-brands":
          return NextResponse.json(await handleListBrands(id), { headers: deprecationHeaders });

        case "get-image": {
          const clientId = authResult?.type === "client" ? authResult.client.clientId : "master";
          const result = await handleGetImage(id, toolArgs, clientId);
          return NextResponse.json(result, { headers: deprecationHeaders });
        }

        case "generate-image": {
          const brand = typeof toolArgs.brand === "string" ? toolArgs.brand : getEnv().DEFAULT_BRAND;
          if (
            authResult?.type === "client" &&
            authResult.client.scopes?.length &&
            !authResult.client.scopes.includes(brand)
          ) {
            return NextResponse.json(
              buildErrorResponse(id, SCOPE_DENIED, `Your API key does not have access to brand "${brand}".`),
              { headers: deprecationHeaders },
            );
          }

          const clientId = authResult?.type === "client" ? authResult.client.clientId : "master";
          const clientName = authResult?.type === "client" ? authResult.client.clientName : "master";
          const result = await handleGenerateImage(id, toolArgs, (meta) => {
            after(logUsage({
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
              endpoint: "mcp-legacy",
              timestamp: new Date(),
            }));
          });
          return NextResponse.json(result, { headers: deprecationHeaders });
        }

        default:
          return NextResponse.json(
            buildErrorResponse(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName}`),
            { headers: deprecationHeaders },
          );
      }
    } catch (error) {
      createLogger({ requestId, module: "mcp-legacy" }).error("Dispatch error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        buildErrorResponse(id, INTERNAL_ERROR, "Internal error"),
        { headers: deprecationHeaders },
      );
    }
  }

  return NextResponse.json(
    buildErrorResponse(id, METHOD_NOT_FOUND, `Unknown method: ${method}`),
    { headers: deprecationHeaders },
  );
}
