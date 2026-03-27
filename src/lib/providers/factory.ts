import type { ImageProvider } from "./types";
import { openaiProvider } from "./openai";
import { mockProvider } from "./mock";
import { replicateProvider } from "./replicate";

const providers: Record<string, ImageProvider> = {
  openai: openaiProvider,
  replicate: replicateProvider,
  mock: mockProvider,
};

export function getProvider(name?: string): ImageProvider {
  const useMock = process.env.USE_MOCK_PROVIDER === "true";
  const defaultProvider = process.env.DEFAULT_PROVIDER ?? "openai";
  const providerName = name ?? (useMock ? "mock" : defaultProvider);
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(
      `Unknown image provider: "${providerName}". Available: ${Object.keys(providers).join(", ")}`
    );
  }

  return provider;
}

