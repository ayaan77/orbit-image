import { describe, it, expect } from "vitest";
import {
  PARSE_ERROR,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  INVALID_PARAMS,
  INTERNAL_ERROR,
  AUTH_REQUIRED,
  RATE_LIMITED,
  PROVIDER_ERROR,
  CORTEX_ERROR,
  buildErrorResponse,
  buildSuccessResponse,
  buildToolsListResponse,
} from "@/lib/mcp/errors";

describe("MCP Error Codes", () => {
  it("exports standard JSON-RPC 2.0 error codes", () => {
    expect(PARSE_ERROR).toBe(-32700);
    expect(INVALID_REQUEST).toBe(-32600);
    expect(METHOD_NOT_FOUND).toBe(-32601);
    expect(INVALID_PARAMS).toBe(-32602);
    expect(INTERNAL_ERROR).toBe(-32603);
  });

  it("exports application-specific error codes", () => {
    expect(AUTH_REQUIRED).toBe(-32001);
    expect(RATE_LIMITED).toBe(-32002);
    expect(PROVIDER_ERROR).toBe(-32003);
    expect(CORTEX_ERROR).toBe(-32004);
  });
});

describe("buildErrorResponse", () => {
  it("returns a valid JSON-RPC error response", () => {
    const res = buildErrorResponse("req-1", PARSE_ERROR, "Parse error");

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: "req-1",
      error: { code: -32700, message: "Parse error" },
    });
  });

  it("handles numeric ids", () => {
    const res = buildErrorResponse(42, INTERNAL_ERROR, "Internal error");

    expect(res.id).toBe(42);
    expect(res.error.code).toBe(-32603);
  });

  it("handles null id (for parse errors before id is extracted)", () => {
    const res = buildErrorResponse(null, PARSE_ERROR, "Invalid JSON");

    expect(res.id).toBeNull();
    expect(res.jsonrpc).toBe("2.0");
  });
});

describe("buildSuccessResponse", () => {
  it("wraps data in MCP content format", () => {
    const data = { styles: ["flat", "3d"] };
    const res = buildSuccessResponse("req-2", data);

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: "req-2",
      result: {
        content: [{ type: "text", text: JSON.stringify(data) }],
      },
    });
  });

  it("handles numeric ids", () => {
    const res = buildSuccessResponse(7, "hello");

    expect(res.id).toBe(7);
    expect(res.result).toEqual({
      content: [{ type: "text", text: '"hello"' }],
    });
  });

  it("serializes nested objects correctly", () => {
    const data = { images: [{ url: "https://example.com/img.png", width: 1024 }] };
    const res = buildSuccessResponse("req-3", data);
    const parsed = JSON.parse(
      (res.result as { content: { text: string }[] }).content[0].text
    );

    expect(parsed).toEqual(data);
  });
});

describe("buildToolsListResponse", () => {
  it("returns tools array in result", () => {
    const tools = [
      { name: "generate-image", description: "Generate images", inputSchema: {} },
      { name: "list-styles", description: "List styles", inputSchema: {} },
    ];
    const res = buildToolsListResponse("req-4", tools);

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: "req-4",
      result: { tools },
    });
  });

  it("handles empty tools array", () => {
    const res = buildToolsListResponse(1, []);

    expect(res).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    });
  });
});
