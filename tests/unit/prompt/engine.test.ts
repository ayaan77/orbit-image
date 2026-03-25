import { describe, it, expect } from "vitest";
import { assemblePrompt } from "@/lib/prompt/engine";
import type { BrandContext } from "@/lib/cortex/types";
import {
  mockColours,
  mockBrandVoice,
  mockCompany,
  mockProof,
} from "../../mocks/cortex-responses";

const baseContext: BrandContext = {
  colours: mockColours,
  voice: mockBrandVoice,
  company: mockCompany,
};

const contextWithProof: BrandContext = {
  ...baseContext,
  proof: mockProof,
};

describe("assemblePrompt", () => {
  it("generates a prompt for blog-hero purpose", () => {
    const bundle = assemblePrompt(
      {
        topic: "B2B SaaS landing page optimization",
        purpose: "blog-hero",
        count: 1,
        quality: "hd",
      },
      baseContext
    );

    expect(bundle.positive).toContain("B2B SaaS landing page optimization");
    expect(bundle.positive).toContain("blog");
    expect(bundle.dimensions).toEqual({ width: 1536, height: 1024 });
    expect(bundle.quality).toBe("hd");
    expect(bundle.count).toBe(1);
  });

  it("includes brand color references", () => {
    const bundle = assemblePrompt(
      {
        topic: "CRO testing",
        purpose: "social-og",
        count: 1,
        quality: "hd",
      },
      baseContext
    );

    expect(bundle.positive).toContain("deep purple");
  });

  it("includes brand personality", () => {
    const bundle = assemblePrompt(
      {
        topic: "Landing page design",
        purpose: "ad-creative",
        count: 1,
        quality: "hd",
      },
      baseContext
    );

    expect(bundle.positive).toContain("professional-casual");
    expect(bundle.positive).toContain("Apexure");
  });

  it("includes proof context when available", () => {
    const bundle = assemblePrompt(
      {
        topic: "B2B lead generation",
        purpose: "case-study",
        count: 1,
        quality: "hd",
      },
      contextWithProof
    );

    expect(bundle.positive).toContain("$2,300 to $550");
  });

  it("applies style modifier", () => {
    const bundle = assemblePrompt(
      {
        topic: "CRO testing",
        purpose: "blog-hero",
        style: "illustration",
        count: 1,
        quality: "hd",
      },
      baseContext
    );

    expect(bundle.positive).toContain("illustration");
  });

  it("uses custom dimensions when provided", () => {
    const bundle = assemblePrompt(
      {
        topic: "CRO",
        purpose: "icon",
        dimensions: { width: 512, height: 512 },
        count: 1,
        quality: "standard",
      },
      baseContext
    );

    expect(bundle.dimensions).toEqual({ width: 512, height: 512 });
    expect(bundle.quality).toBe("standard");
  });

  it("uses default dimensions per purpose", () => {
    const iconBundle = assemblePrompt(
      { topic: "CRO", purpose: "icon", count: 1, quality: "hd" },
      baseContext
    );
    expect(iconBundle.dimensions).toEqual({ width: 1024, height: 1024 });

    const infraBundle = assemblePrompt(
      { topic: "CRO", purpose: "infographic", count: 1, quality: "hd" },
      baseContext
    );
    expect(infraBundle.dimensions).toEqual({ width: 1024, height: 1536 });
  });

  it("generates a non-empty negative prompt", () => {
    const bundle = assemblePrompt(
      { topic: "Test", purpose: "blog-hero", count: 1, quality: "hd" },
      baseContext
    );

    expect(bundle.negative.length).toBeGreaterThan(0);
    expect(bundle.negative).toContain("No text");
  });

  it("respects count parameter", () => {
    const bundle = assemblePrompt(
      { topic: "Test", purpose: "blog-hero", count: 3, quality: "hd" },
      baseContext
    );
    expect(bundle.count).toBe(3);
  });
});
