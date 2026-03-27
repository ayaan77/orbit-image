import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveModel } from "@/lib/providers/factory";
import { ProviderError } from "@/lib/providers/types";
import { MODEL_CATALOG, DEFAULT_MODEL, MODEL_IDS } from "@/lib/providers/models";

describe("resolveModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no args → returns default model (gpt-image-1) with openai provider", () => {
    const { provider, internalModel } = resolveModel();
    expect(provider.name).toBe("openai");
    expect(internalModel).toBe("gpt-image-1");
    expect(internalModel).toBe(MODEL_CATALOG[DEFAULT_MODEL].internalModel);
  });

  it("'gpt-image-1' → openai provider", () => {
    const { provider, internalModel } = resolveModel("gpt-image-1");
    expect(provider.name).toBe("openai");
    expect(internalModel).toBe("gpt-image-1");
  });

  it("'dall-e-3' → openai provider with dall-e-3 internalModel", () => {
    const { provider, internalModel } = resolveModel("dall-e-3");
    expect(provider.name).toBe("openai");
    expect(internalModel).toBe("dall-e-3");
  });

  it("'flux-schnell' → replicate provider with correct slug", () => {
    const { provider, internalModel } = resolveModel("flux-schnell");
    expect(provider.name).toBe("replicate");
    expect(internalModel).toBe("black-forest-labs/flux-schnell");
  });

  it("'flux-pro' → replicate provider with correct slug", () => {
    const { provider, internalModel } = resolveModel("flux-pro");
    expect(provider.name).toBe("replicate");
    expect(internalModel).toBe("black-forest-labs/flux-1.1-pro");
  });

  it("'flux-dev' → replicate provider with correct slug", () => {
    const { provider, internalModel } = resolveModel("flux-dev");
    expect(provider.name).toBe("replicate");
    expect(internalModel).toBe("black-forest-labs/flux-dev");
  });

  it("'grok-aurora' → xai provider with grok-2-image internalModel", () => {
    const { provider, internalModel } = resolveModel("grok-aurora");
    expect(provider.name).toBe("xai");
    expect(internalModel).toBe("grok-2-image");
  });

  it("unknown model → throws ProviderError with helpful message", () => {
    expect(() => resolveModel("made-up-model")).toThrowError(ProviderError);
    expect(() => resolveModel("made-up-model")).toThrow("Unknown model");
  });

  it("error message includes available model IDs", () => {
    try {
      resolveModel("bad-model");
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      for (const id of MODEL_IDS) {
        expect((err as Error).message).toContain(id);
      }
    }
  });

  it("USE_MOCK_PROVIDER=true → all models return mock provider", () => {
    vi.stubEnv("USE_MOCK_PROVIDER", "true");
    for (const id of MODEL_IDS) {
      const { provider } = resolveModel(id);
      expect(provider.name).toBe("mock");
    }
  });

  it("USE_MOCK_PROVIDER=true with no args → mock provider", () => {
    vi.stubEnv("USE_MOCK_PROVIDER", "true");
    const { provider } = resolveModel();
    expect(provider.name).toBe("mock");
  });

  it("internalModel matches catalog for every model ID", () => {
    for (const id of MODEL_IDS) {
      const { internalModel } = resolveModel(id);
      expect(internalModel).toBe(MODEL_CATALOG[id].internalModel);
    }
  });
});
