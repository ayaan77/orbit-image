import { describe, it, expect } from "vitest";
import { estimateCost } from "@/lib/usage/cost";

describe("estimateCost", () => {
  it("returns ~$0.042 for 1 HD image", () => {
    expect(estimateCost(1, "hd")).toBe(0.042);
  });

  it("returns ~$0.011 for 1 standard image", () => {
    expect(estimateCost(1, "standard")).toBe(0.011);
  });

  it("scales with count", () => {
    expect(estimateCost(4, "hd")).toBe(0.168);
  });

  it("treats unknown quality as standard", () => {
    expect(estimateCost(1, "unknown")).toBe(0.011);
  });
});
