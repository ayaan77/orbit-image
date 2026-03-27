import { describe, it, expect } from "vitest";
import {
  MODEL_CATALOG,
  MODEL_IDS,
  DEFAULT_MODEL,
  type ModelEntry,
} from "@/lib/providers/models";

describe("MODEL_CATALOG", () => {
  it("DEFAULT_MODEL exists in catalog", () => {
    expect(MODEL_CATALOG[DEFAULT_MODEL]).toBeDefined();
  });

  it("MODEL_IDS matches catalog keys", () => {
    expect(MODEL_IDS).toEqual(Object.keys(MODEL_CATALOG));
  });

  it.each(MODEL_IDS)('"%s" has all required fields', (id) => {
    const entry: ModelEntry = MODEL_CATALOG[id];
    expect(entry.displayName).toBeTruthy();
    expect(entry.provider).toMatch(/^(openai|replicate|xai)$/);
    expect(entry.internalModel).toBeTruthy();
    expect(entry.badge).toBeTruthy();
    expect(entry.tier).toMatch(/^(fast|standard|premium)$/);
    expect(entry.requiresEnv).toBeTruthy();
  });

  it("no duplicate internalModel values", () => {
    const internalModels = MODEL_IDS.map((id) => MODEL_CATALOG[id].internalModel);
    const unique = new Set(internalModels);
    expect(unique.size).toBe(internalModels.length);
  });

  it("OpenAI models reference OPENAI_API_KEY", () => {
    const openaiModels = MODEL_IDS.filter((id) => MODEL_CATALOG[id].provider === "openai");
    for (const id of openaiModels) {
      expect(MODEL_CATALOG[id].requiresEnv).toBe("OPENAI_API_KEY");
    }
  });

  it("Replicate models reference REPLICATE_API_TOKEN", () => {
    const replicateModels = MODEL_IDS.filter((id) => MODEL_CATALOG[id].provider === "replicate");
    for (const id of replicateModels) {
      expect(MODEL_CATALOG[id].requiresEnv).toBe("REPLICATE_API_TOKEN");
    }
  });

  it("xAI models reference XAI_API_KEY", () => {
    const xaiModels = MODEL_IDS.filter((id) => MODEL_CATALOG[id].provider === "xai");
    for (const id of xaiModels) {
      expect(MODEL_CATALOG[id].requiresEnv).toBe("XAI_API_KEY");
    }
  });

  it("has exactly 6 models", () => {
    expect(MODEL_IDS).toHaveLength(6);
  });
});
