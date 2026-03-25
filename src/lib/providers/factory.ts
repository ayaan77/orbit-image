import type { ImageProvider } from "./types";
import { openaiProvider } from "./openai";

const providers: Record<string, ImageProvider> = {
  openai: openaiProvider,
};

export function getProvider(name?: string): ImageProvider {
  const providerName = name ?? "openai";
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(
      `Unknown image provider: "${providerName}". Available: ${Object.keys(providers).join(", ")}`
    );
  }

  return provider;
}

