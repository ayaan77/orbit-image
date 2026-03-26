import type { ImageProvider } from "./types";
import { openaiProvider } from "./openai";
import { mockProvider } from "./mock";

const providers: Record<string, ImageProvider> = {
  openai: openaiProvider,
  mock: mockProvider,
};

export function getProvider(name?: string): ImageProvider {
  const useMock = process.env.USE_MOCK_PROVIDER === "true";
  const providerName = name ?? (useMock ? "mock" : "openai");
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(
      `Unknown image provider: "${providerName}". Available: ${Object.keys(providers).join(", ")}`
    );
  }

  return provider;
}

