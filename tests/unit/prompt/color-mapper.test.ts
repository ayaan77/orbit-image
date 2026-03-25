import { describe, it, expect } from "vitest";
import {
  buildColorPromptSection,
  mapColorsToDirectives,
  getColorHexList,
} from "@/lib/prompt/color-mapper";
import { mockColours } from "../../mocks/cortex-responses";

describe("color-mapper", () => {
  describe("mapColorsToDirectives", () => {
    it("maps all 8 brand colors to directives", () => {
      const directives = mapColorsToDirectives(mockColours);
      expect(directives).toHaveLength(8);
    });

    it("includes hex values in descriptions", () => {
      const directives = mapColorsToDirectives(mockColours);
      const primary = directives.find((d) => d.role === "primary");
      expect(primary?.description).toContain("#410099");
    });

    it("assigns correct roles", () => {
      const directives = mapColorsToDirectives(mockColours);
      const roles = directives.map((d) => d.role);
      expect(roles).toContain("primary");
      expect(roles).toContain("secondary");
      expect(roles).toContain("dark");
      expect(roles).toContain("highlight");
    });
  });

  describe("buildColorPromptSection", () => {
    it("returns a non-empty string", () => {
      const section = buildColorPromptSection(mockColours);
      expect(section.length).toBeGreaterThan(0);
    });

    it("includes primary color hex", () => {
      const section = buildColorPromptSection(mockColours);
      expect(section).toContain("deep purple");
    });

    it("includes highlight color", () => {
      const section = buildColorPromptSection(mockColours);
      expect(section).toContain("gold");
    });

    it("ends with a period", () => {
      const section = buildColorPromptSection(mockColours);
      expect(section.endsWith(".")).toBe(true);
    });
  });

  describe("getColorHexList", () => {
    it("returns all 8 hex values", () => {
      const hexList = getColorHexList(mockColours);
      expect(hexList).toHaveLength(8);
      expect(hexList).toContain("#410099");
      expect(hexList).toContain("#ffb600");
    });
  });
});
