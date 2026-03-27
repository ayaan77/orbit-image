import type { ModelId } from "@/lib/providers/models";

/**
 * Per-model pricing (USD per image).
 * Keys: [modelId][quality] or [modelId] for flat-rate models.
 */
const MODEL_PRICING: Record<string, { standard: number; hd: number }> = {
  "gpt-image-1": { standard: 0.011, hd: 0.042 },
  "dall-e-3": { standard: 0.04, hd: 0.08 },
  "flux-pro": { standard: 0.05, hd: 0.05 },
  "flux-dev": { standard: 0.025, hd: 0.025 },
  "flux-schnell": { standard: 0.003, hd: 0.003 },
  "grok-aurora": { standard: 0.07, hd: 0.07 },
};

const DEFAULT_PRICING = MODEL_PRICING["gpt-image-1"];

/**
 * Estimate USD cost for image generation.
 * Backward-compatible: omitting modelId defaults to gpt-image-1 pricing.
 */
export function estimateCost(
  count: number,
  quality: string,
  modelId?: ModelId | string
): number {
  const pricing = (modelId && MODEL_PRICING[modelId]) || DEFAULT_PRICING;
  const perImage = quality === "hd" ? pricing.hd : pricing.standard;
  return Math.round(count * perImage * 1000) / 1000;
}

/** Get the per-image cost for a model + quality combination. */
export function getPerImageCost(
  modelId: ModelId | string,
  quality: string = "hd"
): number {
  const pricing = MODEL_PRICING[modelId] || DEFAULT_PRICING;
  return quality === "hd" ? pricing.hd : pricing.standard;
}
