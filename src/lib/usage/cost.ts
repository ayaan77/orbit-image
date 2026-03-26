/**
 * Estimate USD cost for image generation.
 * Based on OpenAI gpt-image-1 pricing (as of 2025):
 * - Standard quality: ~$0.011 per image
 * - HD quality: ~$0.042 per image
 */
export function estimateCost(
  count: number,
  quality: string
): number {
  const perImage = quality === "hd" ? 0.042 : 0.011;
  return Math.round(count * perImage * 1000) / 1000; // 3 decimal places
}
