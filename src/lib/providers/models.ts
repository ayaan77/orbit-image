export interface ModelEntry {
  readonly displayName: string;
  readonly provider: "openai" | "replicate" | "xai";
  readonly internalModel: string;
  readonly badge: string;
  readonly tier: "fast" | "standard" | "premium";
  readonly requiresEnv: string;
}

export const MODEL_CATALOG = {
  "gpt-image-1": {
    displayName: "GPT Image 1",
    provider: "openai",
    internalModel: "gpt-image-1",
    badge: "OpenAI",
    tier: "standard",
    requiresEnv: "OPENAI_API_KEY",
  },
  "dall-e-3": {
    displayName: "DALL-E 3",
    provider: "openai",
    internalModel: "dall-e-3",
    badge: "OpenAI",
    tier: "premium",
    requiresEnv: "OPENAI_API_KEY",
  },
  "flux-pro": {
    displayName: "Flux 1.1 Pro",
    provider: "replicate",
    internalModel: "black-forest-labs/flux-1.1-pro",
    badge: "Replicate",
    tier: "premium",
    requiresEnv: "REPLICATE_API_TOKEN",
  },
  "flux-dev": {
    displayName: "Flux Dev",
    provider: "replicate",
    internalModel: "black-forest-labs/flux-dev",
    badge: "Replicate",
    tier: "standard",
    requiresEnv: "REPLICATE_API_TOKEN",
  },
  "flux-schnell": {
    displayName: "Flux Schnell",
    provider: "replicate",
    internalModel: "black-forest-labs/flux-schnell",
    badge: "Replicate",
    tier: "fast",
    requiresEnv: "REPLICATE_API_TOKEN",
  },
  "grok-aurora": {
    displayName: "Grok Aurora",
    provider: "xai",
    internalModel: "grok-2-image",
    badge: "xAI",
    tier: "premium",
    requiresEnv: "XAI_API_KEY",
  },
} as const satisfies Record<string, ModelEntry>;

export type ModelId = keyof typeof MODEL_CATALOG;
export const MODEL_IDS = Object.keys(MODEL_CATALOG) as ModelId[];
export const DEFAULT_MODEL: ModelId = "gpt-image-1";
