import type { JsonRpcErrorResponse, JsonRpcSuccessResponse, McpToolDefinition } from "@/types/mcp";

// ─── Standard JSON-RPC 2.0 Error Codes ───

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

// ─── Application Error Codes ───

export const AUTH_REQUIRED = -32001;
export const RATE_LIMITED = -32002;
export const PROVIDER_ERROR = -32003;
export const CORTEX_ERROR = -32004;

// ─── Helpers ───

export function buildErrorResponse(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

export function buildSuccessResponse(
  id: string | number,
  data: unknown
): JsonRpcSuccessResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(data) }],
    },
  };
}

export function buildToolsListResponse(
  id: string | number,
  tools: readonly McpToolDefinition[],
): JsonRpcSuccessResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: { tools },
  };
}
