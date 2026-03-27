import type { ImageProvider } from "./types";
import { ProviderError } from "./types";
import { openaiProvider } from "./openai";
import { mockProvider } from "./mock";
import { replicateProvider } from "./replicate";
import { xaiProvider } from "./xai";
import { MODEL_CATALOG, DEFAULT_MODEL, type ModelId } from "./models";

const providerMap: Record<string, ImageProvider> = {
  openai: openaiProvider,
  replicate: replicateProvider,
  xai: xaiProvider,
  mock: mockProvider,
};

/**
 * Resolve a model ID from the catalog to its provider + internal model string.
 * Falls back to DEFAULT_MODEL when modelId is omitted.
 */
export function resolveModel(modelId?: string): { provider: ImageProvider; internalModel: string } {
  const useMock = process.env.USE_MOCK_PROVIDER === "true";

  const id = (modelId ?? DEFAULT_MODEL) as ModelId;
  const entry = MODEL_CATALOG[id];
  if (!entry) {
    throw new ProviderError(
      `Unknown model: "${modelId}". Available: ${Object.keys(MODEL_CATALOG).join(", ")}`
    );
  }

  const provider = useMock ? mockProvider : providerMap[entry.provider];
  return { provider, internalModel: entry.internalModel };
}

/**
 * Legacy helper — resolves a provider by provider name (openai/replicate/xai/mock).
 * Prefer resolveModel() for new code.
 */
export function getProvider(name?: string): ImageProvider {
  const useMock = process.env.USE_MOCK_PROVIDER === "true";
  const defaultProvider = process.env.DEFAULT_PROVIDER ?? "openai";
  const providerName = name ?? (useMock ? "mock" : defaultProvider);
  const provider = providerMap[providerName];

  if (!provider) {
    throw new Error(
      `Unknown image provider: "${providerName}". Available: ${Object.keys(providerMap).join(", ")}`
    );
  }

  return provider;
}
