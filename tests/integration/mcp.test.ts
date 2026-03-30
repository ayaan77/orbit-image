import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/setup";
import { cacheClear } from "@/lib/cortex/cache";

// Mock provider (resolveModel is used by handlers)
vi.mock("@/lib/providers/factory", () => ({
  resolveModel: () => ({
    provider: {
      name: "openai-mock",
      generate: vi.fn().mockResolvedValue([
        {
          data: Buffer.from("fake-png-data"),
          mimeType: "image/png",
          prompt: "test prompt output",
          dimensions: { width: 1024, height: 1024 },
        },
      ]),
    },
    internalModel: "mock-model",
  }),
}));

// Mock concurrency queue (pass-through)
vi.mock("@/lib/queue/concurrency-queue", () => ({
  getGenerateQueue: () => ({
    enqueue: <T>(fn: () => Promise<T>) => fn(),
  }),
}));

// Mock blob upload
vi.mock("@/lib/mcp/blob", () => ({
  uploadImageToBlob: vi.fn().mockResolvedValue({
    url: "https://blob.vercel-storage.com/orbit/apexure/blog-hero/test.png",
    pathname: "orbit/apexure/blog-hero/test.png",
  }),
}));

const CORTEX_URL = "https://cortex.test.apexure.com/api/mcp";

// Use the legacy JSON-RPC endpoint for these tests.
// The main /api/mcp route now uses Streamable HTTP transport (MCP SDK).
const { POST } = await import("@/app/api/mcp/legacy/route");

function makeJsonRpcRequest(
  method: string,
  params: Record<string, unknown> = {},
  options?: { apiKey?: string | null; id?: string | number }
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.apiKey !== null) {
    headers["Authorization"] = `Bearer ${options?.apiKey ?? "test-secret"}`;
  }

  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: options?.id ?? "test-1",
      method,
      params,
    }),
  });
}

function makeRawRequest(body: string): Request {
  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/mcp", () => {
  beforeEach(() => {
    cacheClear();
  });

  // ─── 1. tools/list — no auth ───
  it("returns tool definitions for tools/list", async () => {
    const req = makeJsonRpcRequest("tools/list", {}, { apiKey: null });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.jsonrpc).toBe("2.0");
    expect(data.id).toBe("test-1");
    expect(data.result.tools).toHaveLength(5);

    const names = data.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("generate-image");
    expect(names).toContain("list-styles");
    expect(names).toContain("list-purposes");
    expect(names).toContain("list-brands");
    expect(names).toContain("get-image");
  });

  // ─── 2. list-styles — no auth ───
  it("returns styles via list-styles tool", async () => {
    const req = makeJsonRpcRequest(
      "tools/call",
      { name: "list-styles", arguments: {} },
      { apiKey: null }
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    const content = JSON.parse(data.result.content[0].text);
    expect(content.styles).toHaveLength(6);
    expect(content.styles[0]).toHaveProperty("name");
    expect(content.styles[0]).toHaveProperty("description");
  });

  // ─── 3. list-purposes — no auth ───
  it("returns purposes via list-purposes tool", async () => {
    const req = makeJsonRpcRequest(
      "tools/call",
      { name: "list-purposes", arguments: {} },
      { apiKey: null }
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    const content = JSON.parse(data.result.content[0].text);
    expect(content.purposes).toHaveLength(6);

    const blogHero = content.purposes.find(
      (p: { name: string }) => p.name === "blog-hero"
    );
    expect(blogHero.defaultDimensions).toEqual({ width: 1536, height: 1024 });
  });

  // ─── 4. generate-image with valid auth → URL output ───
  it("generates image with URL output format", async () => {
    const req = makeJsonRpcRequest("tools/call", {
      name: "generate-image",
      arguments: {
        topic: "Landing page hero for SaaS product",
        purpose: "blog-hero",
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error).toBeUndefined();

    const content = JSON.parse(data.result.content[0].text);
    expect(content.images).toHaveLength(1);
    expect(content.images[0].url).toContain("blob.vercel-storage.com");
    expect(content.output_format).toBe("url");
    expect(content.brand).toBe("apexure");
  });

  // ─── 5. generate-image with base64 output ───
  it("generates image with base64 output format", async () => {
    const req = makeJsonRpcRequest("tools/call", {
      name: "generate-image",
      arguments: {
        topic: "Social media graphic",
        purpose: "social-og",
        output_format: "base64",
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    const content = JSON.parse(data.result.content[0].text);
    expect(content.images[0]).toHaveProperty("base64");
    expect(content.images[0]).not.toHaveProperty("url");
    expect(content.output_format).toBe("base64");
  });

  // ─── 6. generate-image without auth → AUTH_REQUIRED ───
  it("returns AUTH_REQUIRED for generate-image without auth", async () => {
    const req = makeJsonRpcRequest(
      "tools/call",
      {
        name: "generate-image",
        arguments: { topic: "test", purpose: "icon" },
      },
      { apiKey: null }
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe(-32001);
  });

  // ─── 7. Unknown tool → METHOD_NOT_FOUND ───
  it("returns METHOD_NOT_FOUND for unknown tool", async () => {
    const req = makeJsonRpcRequest("tools/call", {
      name: "nonexistent-tool",
      arguments: {},
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error.code).toBe(-32601);
    expect(data.error.message).toContain("nonexistent-tool");
  });

  // ─── 8. Invalid JSON → PARSE_ERROR ───
  it("returns PARSE_ERROR for invalid JSON body", async () => {
    const req = makeRawRequest("not valid json {{{");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error.code).toBe(-32700);
    expect(data.id).toBeNull();
  });

  // ─── 9. Invalid JSON-RPC structure → INVALID_REQUEST ───
  it("returns INVALID_REQUEST for missing jsonrpc field", async () => {
    const req = makeRawRequest(
      JSON.stringify({ id: 1, method: "tools/list" })
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error.code).toBe(-32600);
  });

  // ─── 10. Invalid generate-image params → INVALID_PARAMS ───
  it("returns INVALID_PARAMS for invalid generate-image arguments", async () => {
    const req = makeJsonRpcRequest("tools/call", {
      name: "generate-image",
      arguments: { topic: "", purpose: "bad-purpose" },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error.code).toBe(-32602);
  });

  // ─── 11. Cortex failure → CORTEX_ERROR ───
  it("returns CORTEX_ERROR when Cortex is unreachable", async () => {
    server.use(
      http.post(CORTEX_URL, () => {
        return HttpResponse.error();
      })
    );

    const req = makeJsonRpcRequest("tools/call", {
      name: "generate-image",
      arguments: {
        topic: "Test image",
        purpose: "icon",
      },
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error.code).toBe(-32004);
  });

  // ─── 12. Unknown method → METHOD_NOT_FOUND ───
  it("returns METHOD_NOT_FOUND for unknown JSON-RPC method", async () => {
    const req = makeJsonRpcRequest("resources/list");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error.code).toBe(-32601);
    expect(data.error.message).toContain("resources/list");
  });
});
