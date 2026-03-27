import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/setup";
import { cacheClear } from "@/lib/cortex/cache";

// Mock image providers to avoid real API calls
const mockGenerate = vi.fn().mockResolvedValue([
  {
    data: Buffer.from("fake-png-data"),
    mimeType: "image/png",
    prompt: "test prompt output",
    dimensions: { width: 1024, height: 1024 },
  },
]);

const mockProvider = { name: "openai-mock", generate: mockGenerate };

vi.mock("@/lib/providers/factory", () => ({
  getProvider: () => mockProvider,
  resolveModel: () => ({ provider: mockProvider, internalModel: "gpt-image-1" }),
}));

const CORTEX_URL = "https://cortex.test.apexure.com/api/mcp";

// Import the route handler AFTER mocks are set up
const { POST } = await import("@/app/api/generate/route");

function makeRequest(
  body: Record<string, unknown>,
  options?: { apiKey?: string; contentLength?: string }
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options?.apiKey !== undefined) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  } else {
    headers["Authorization"] = "Bearer test-secret";
  }

  if (options?.contentLength) {
    headers["Content-Length"] = options.contentLength;
  }

  return new Request("http://localhost:3000/api/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    cacheClear();
  });

  it("returns generated image for valid request", async () => {
    const request = makeRequest({
      topic: "B2B SaaS landing page optimization",
      purpose: "blog-hero",
      brand: "apexure",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.images).toHaveLength(1);
    expect(json.images[0].mimeType).toBe("image/png");
    expect(json.images[0].base64).toBeDefined();
    expect(json.images[0].prompt).toBeDefined();
    expect(json.images[0].dimensions).toEqual({ width: 1024, height: 1024 });
    expect(json.brand).toBe("apexure");
    expect(json.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(json.metadata.cortexDataCached).toBe(false);
  });

  it("uses default brand when none specified", async () => {
    const request = makeRequest({
      topic: "CRO best practices",
      purpose: "social-og",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.brand).toBe("apexure");
  });

  it("returns 401 without authorization header", async () => {
    const request = new Request("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: "test", purpose: "blog-hero" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with invalid API key", async () => {
    const request = makeRequest(
      { topic: "test", purpose: "blog-hero" },
      { apiKey: "wrong-key" }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for missing required fields", async () => {
    const request = makeRequest({ topic: "test" }); // missing purpose

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid purpose", async () => {
    const request = makeRequest({
      topic: "test",
      purpose: "not-a-valid-purpose",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("returns 502 when Cortex is unreachable", async () => {
    server.use(
      http.post(CORTEX_URL, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const request = makeRequest({
      topic: "test topic",
      purpose: "blog-hero",
    });

    const response = await POST(request);
    const json = await response.json();

    // Cortex errors now cause graceful degradation (generic prompt) rather than 502
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.metadata.cortexAvailable).toBe(false);
  });

  it("returns cortexDataCached true on second request", async () => {
    const body = {
      topic: "caching test topic",
      purpose: "blog-hero" as const,
      brand: "apexure",
    };

    // First request — cold cache
    const response1 = await POST(makeRequest(body));
    const json1 = await response1.json();
    expect(json1.success).toBe(true);
    expect(json1.metadata.cortexDataCached).toBe(false);

    // Second request — warm cache
    const response2 = await POST(makeRequest(body));
    const json2 = await response2.json();
    expect(json2.success).toBe(true);
    expect(json2.metadata.cortexDataCached).toBe(true);
  });

  it("accepts all valid purpose types", async () => {
    const purposes = [
      "blog-hero",
      "social-og",
      "ad-creative",
      "case-study",
      "icon",
      "infographic",
    ];

    for (const purpose of purposes) {
      cacheClear();
      const request = makeRequest({ topic: "test", purpose });
      const response = await POST(request);
      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    }
  });

  it("accepts optional style parameter", async () => {
    const request = makeRequest({
      topic: "Modern SaaS dashboard",
      purpose: "blog-hero",
      style: "minimalist",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
