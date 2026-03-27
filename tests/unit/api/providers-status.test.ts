import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/providers/status/route";

vi.mock("@/lib/middleware/auth", () => ({
  authenticateRequest: vi.fn(),
}));

import { authenticateRequest } from "@/lib/middleware/auth";
const mockAuth = vi.mocked(authenticateRequest);

describe("GET /api/providers/status", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockAuth.mockReset();
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({
      type: "error",
      code: "UNAUTHORIZED",
      message: "Missing Authorization header",
    });

    const request = new Request("http://localhost/api/providers/status");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("returns provider status when authenticated with master key", async () => {
    mockAuth.mockResolvedValue({ type: "master" });
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.XAI_API_KEY;

    const request = new Request("http://localhost/api/providers/status");
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.providers.openai.configured).toBe(true);
    expect(json.providers.replicate.configured).toBe(false);
    expect(json.providers.xai.configured).toBe(false);
    expect(json.defaultModel).toBe("gpt-image-1");
    expect(Array.isArray(json.availableModels)).toBe(true);
    expect(json.availableModels).toContain("gpt-image-1");
    expect(json.availableModels).toContain("dall-e-3");
    expect(json.availableModels).not.toContain("flux-pro");
  });

  it("includes replicate models when token is set", async () => {
    mockAuth.mockResolvedValue({ type: "master" });
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.REPLICATE_API_TOKEN = "r8-test";
    delete process.env.XAI_API_KEY;

    const request = new Request("http://localhost/api/providers/status");
    const response = await GET(request);
    const json = await response.json();

    expect(json.providers.replicate.configured).toBe(true);
    expect(json.availableModels).toContain("flux-pro");
    expect(json.availableModels).toContain("flux-schnell");
  });

  it("works with client key auth", async () => {
    mockAuth.mockResolvedValue({
      type: "client",
      client: {
        clientId: "test",
        clientName: "Test",
        createdAt: new Date().toISOString(),
        active: true,
      },
    });
    process.env.OPENAI_API_KEY = "sk-test";

    const request = new Request("http://localhost/api/providers/status");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });
});
