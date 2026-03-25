import { describe, it, expect, beforeEach } from "vitest";
import {
  cacheGet,
  cacheSet,
  cacheClear,
  buildCacheKey,
} from "@/lib/cortex/cache";

describe("cache", () => {
  beforeEach(() => {
    cacheClear();
  });

  describe("cacheGet/cacheSet", () => {
    it("returns undefined for missing keys", () => {
      expect(cacheGet("nonexistent")).toBeUndefined();
    });

    it("stores and retrieves a value", () => {
      cacheSet("test-key", { hello: "world" }, 60_000);
      expect(cacheGet("test-key")).toEqual({ hello: "world" });
    });

    it("returns undefined for expired entries", async () => {
      cacheSet("short-lived", "value", 1); // 1ms TTL
      await new Promise((r) => setTimeout(r, 10));
      expect(cacheGet("short-lived")).toBeUndefined();
    });
  });

  describe("cacheClear", () => {
    it("clears all entries when no prefix given", () => {
      cacheSet("a", 1, 60_000);
      cacheSet("b", 2, 60_000);
      cacheClear();
      expect(cacheGet("a")).toBeUndefined();
      expect(cacheGet("b")).toBeUndefined();
    });

    it("clears only entries matching prefix", () => {
      cacheSet("apexure:colours", "c1", 60_000);
      cacheSet("apexure:voice", "v1", 60_000);
      cacheSet("arb:colours", "c2", 60_000);
      cacheClear("apexure:");
      expect(cacheGet("apexure:colours")).toBeUndefined();
      expect(cacheGet("apexure:voice")).toBeUndefined();
      expect(cacheGet("arb:colours")).toBe("c2");
    });
  });

  describe("buildCacheKey", () => {
    it("builds key without args", () => {
      expect(buildCacheKey("apexure", "get-colours")).toBe(
        "apexure:get-colours"
      );
    });

    it("builds key with args", () => {
      const key = buildCacheKey("apexure", "get-proof", {
        topic: "CRO",
        industry: "SaaS",
      });
      expect(key).toContain("apexure:get-proof:");
      expect(key).toContain("CRO");
      expect(key).toContain("SaaS");
    });

    it("produces consistent keys for same args in different order", () => {
      const key1 = buildCacheKey("apexure", "get-proof", {
        b: "2",
        a: "1",
      });
      const key2 = buildCacheKey("apexure", "get-proof", {
        a: "1",
        b: "2",
      });
      expect(key1).toBe(key2);
    });
  });
});
