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
  INTERNAL_ERROR,
} from "@/lib/mcp/errors";
import {
  handleListStyles,
  handleListPurposes,
  handleGenerateImage,
} from "@/lib/mcp/handlers";
import { authenticateRequest } from "@/lib/middleware/auth";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { logUsage } from "@/lib/usage/logger";
import { estimateCost } from "@/lib/usage/cost";

export const maxDuration = 60;

/**
 * MCP Server endpoint — JSON-RPC 2.0 over HTTP.
 * Always returns HTTP 200. Errors are in the JSON-RPC envelope.
 */
export async function POST(
  request: Request
): Promise<NextResponse<JsonRpcResponse>> {
  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      buildErrorResponse(null, PARSE_ERROR, "Invalid JSON")
    );
  }

  // Validate JSON-RPC structure
  const parsed = JsonRpcRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      buildErrorResponse(null, INVALID_REQUEST, "Invalid JSON-RPC 2.0 request")
    );
  }

  const { id, method, params } = parsed.data;

  // ─── tools/list — return all tool definitions ───
  if (method === "tools/list") {
    return NextResponse.json(
      buildToolsListResponse(id, getToolDefinitions() as unknown as Record<string, unknown>[])
    );
  }

  // ─── tools/call — dispatch to a specific tool ───
  if (method === "tools/call") {
    const toolName = params.name as string | undefined;
    const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

    if (!toolName || !findTool(toolName)) {
      return NextResponse.json(
        buildErrorResponse(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName ?? "undefined"}`)
      );
    }

    // Auth check for protected tools
    let authResult: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
    if (isAuthRequired(toolName)) {
      authResult = await authenticateRequest(request);
      if (authResult.type === "error") {
        return NextResponse.json(
          buildErrorResponse(id, AUTH_REQUIRED, "Authentication required for generate-image")
        );
      }

      const rateLimitError = checkRateLimit(request);
      if (rateLimitError) {
        return NextResponse.json(
          buildErrorResponse(id, RATE_LIMITED, "Rate limit exceeded")
        );
      }
    }

    // Dispatch
    try {
      switch (toolName) {
        case "list-styles":
          return NextResponse.json(handleListStyles(id));

        case "list-purposes":
          return NextResponse.json(handleListPurposes(id));

        case "generate-image": {
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
              endpoint: "mcp",
              timestamp: new Date(),
            }));
          });
          return NextResponse.json(result);
        }

        default:
          return NextResponse.json(
            buildErrorResponse(id, METHOD_NOT_FOUND, `Unknown tool: ${toolName}`)
          );
      }
    } catch (error) {
      console.error("[mcp] Dispatch error:", error);
      return NextResponse.json(
        buildErrorResponse(id, INTERNAL_ERROR, "Internal error")
      );
    }
  }

  // Unknown method
  return NextResponse.json(
    buildErrorResponse(id, METHOD_NOT_FOUND, `Unknown method: ${method}`)
  );
}
