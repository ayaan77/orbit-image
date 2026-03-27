import { describe, it, expect } from "vitest";
import { estimateCost, getPerImageCost } from "@/lib/usage/cost";

describe("estimateCost", () => {
  it("returns ~$0.042 for 1 HD image (default gpt-image-1)", () => {
    expect(estimateCost(1, "hd")).toBe(0.042);
  });

  it("returns ~$0.011 for 1 standard image (default gpt-image-1)", () => {
    expect(estimateCost(1, "standard")).toBe(0.011);
  });

  it("scales with count", () => {
    expect(estimateCost(4, "hd")).toBe(0.168);
  });

  it("treats unknown quality as standard", () => {
    expect(estimateCost(1, "unknown")).toBe(0.011);
  });

  // ── Model-aware pricing ──

  it("returns correct pricing for dall-e-3 hd", () => {
    expect(estimateCost(1, "hd", "dall-e-3")).toBe(0.08);
  });

  it("returns correct pricing for dall-e-3 standard", () => {
    expect(estimateCost(1, "standard", "dall-e-3")).toBe(0.04);
  });

  it("returns correct pricing for flux-pro (flat rate)", () => {
    expect(estimateCost(1, "hd", "flux-pro")).toBe(0.05);
    expect(estimateCost(1, "standard", "flux-pro")).toBe(0.05);
  });

  it("returns correct pricing for flux-schnell (cheapest)", () => {
    expect(estimateCost(1, "hd", "flux-schnell")).toBe(0.003);
  });

  it("returns correct pricing for grok-aurora", () => {
    expect(estimateCost(1, "hd", "grok-aurora")).toBe(0.07);
  });

  it("falls back to gpt-image-1 pricing for unknown model", () => {
    expect(estimateCost(1, "hd", "unknown-model")).toBe(0.042);
  });

  it("scales model-specific pricing with count", () => {
    expect(estimateCost(3, "hd", "flux-schnell")).toBe(0.009);
  });
});

describe("getPerImageCost", () => {
  it("returns per-image cost for specific model", () => {
    expect(getPerImageCost("gpt-image-1", "hd")).toBe(0.042);
    expect(getPerImageCost("flux-schnell", "standard")).toBe(0.003);
    expect(getPerImageCost("dall-e-3", "hd")).toBe(0.08);
  });

  it("defaults to hd quality", () => {
    expect(getPerImageCost("gpt-image-1")).toBe(0.042);
  });

  it("falls back to default pricing for unknown model", () => {
    expect(getPerImageCost("nonexistent")).toBe(0.042);
  });
});
