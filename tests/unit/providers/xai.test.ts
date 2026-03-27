import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { xaiProvider } from "@/lib/providers/xai";
import { ProviderError } from "@/lib/providers/types";
import type { PromptBundle } from "@/lib/prompt/types";
import { server } from "../../mocks/setup";

const XAI_URL = "https://api.x.ai/v1/images/generations";

const TEST_BUNDLE: PromptBundle = {
  positive: "A clean modern hero image for a SaaS blog post about productivity",
  negative: "blurry, low quality, text, watermark",
  dimensions: { width: 1024, height: 1024 },
  count: 1,
  quality: "hd",
};

// Minimal valid b64 PNG (1×1 transparent PNG)
const FAKE_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("xaiProvider", () => {
  it("throws ProviderError when XAI_API_KEY is not set", async () => {
    // XAI_API_KEY is not stubbed by default in setup.ts
    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrowError(ProviderError);
    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrow("XAI_API_KEY is not configured");
  });

  it("returns GeneratedImage[] with correct shape on success", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    server.use(
      http.post(XAI_URL, () => HttpResponse.json({ data: [{ b64_json: FAKE_B64 }] }))
    );

    const images = await xaiProvider.generate(TEST_BUNDLE);
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe("image/png");
    expect(images[0].prompt).toBe(TEST_BUNDLE.positive);
    expect(images[0].dimensions).toEqual({ width: 1024, height: 1024 });
    expect(images[0].data).toBeInstanceOf(Buffer);
  });

  it("returns multiple images when count > 1", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    server.use(
      http.post(XAI_URL, () => HttpResponse.json({ data: [{ b64_json: FAKE_B64 }] }))
    );

    const bundle: PromptBundle = { ...TEST_BUNDLE, count: 3 };
    const images = await xaiProvider.generate(bundle);
    expect(images).toHaveLength(3);
  });

  it("resolves wide dimensions to 1792x1024 size", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.post(XAI_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64 }] });
      })
    );

    const bundle: PromptBundle = { ...TEST_BUNDLE, dimensions: { width: 1792, height: 1024 } };
    await xaiProvider.generate(bundle);
    expect(capturedBody.size).toBe("1792x1024");
  });

  it("resolves tall dimensions to 1024x1792 size", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.post(XAI_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64 }] });
      })
    );

    const bundle: PromptBundle = { ...TEST_BUNDLE, dimensions: { width: 1024, height: 1792 } };
    await xaiProvider.generate(bundle);
    expect(capturedBody.size).toBe("1024x1792");
  });

  it("sends model and response_format in request body", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.post(XAI_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: [{ b64_json: FAKE_B64 }] });
      })
    );

    await xaiProvider.generate(TEST_BUNDLE, "grok-2-image");
    expect(capturedBody.model).toBe("grok-2-image");
    expect(capturedBody.response_format).toBe("b64_json");
  });

  it("throws ProviderError on 4xx API response", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    server.use(
      http.post(XAI_URL, () =>
        HttpResponse.json({ error: "invalid_api_key" }, { status: 401 })
      )
    );

    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrowError(ProviderError);
    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrow("401");
  });

  it("throws ProviderError on 5xx API response", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    server.use(
      http.post(XAI_URL, () => new HttpResponse("Internal Server Error", { status: 500 }))
    );

    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrowError(ProviderError);
  });

  it("throws ProviderError when response has no image data", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-test-key");

    server.use(
      http.post(XAI_URL, () => HttpResponse.json({ data: [{}] }))
    );

    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrowError(ProviderError);
    await expect(xaiProvider.generate(TEST_BUNDLE)).rejects.toThrow("no image data");
  });
});
