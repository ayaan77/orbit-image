import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeCacheKey,
  getCachedResult,
  setCachedResult,
  invalidateCache,
} from "@/lib/cache/result-cache";
import type { CachedGenerateResult } from "@/lib/cache/result-cache";

// Mock the KV module
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("@/lib/storage/kv", () => ({
  getKv: () => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
  }),
  resetKv: vi.fn(),
}));

const sampleResult: CachedGenerateResult = {
  images: [
    {
      base64: "abc123",
      prompt: "A test image",
      mimeType: "image/png",
      dimensions: { width: 1024, height: 1024 },
    },
  ],
  brand: "apexure",
  createdAt: "2026-03-26T00:00:00.000Z",
};

describe("computeCacheKey", () => {
  it("produces deterministic hashes for same input", () => {
    const params = {
      topic: "hero banner",
      brand: "apexure",
      purpose: "blog-hero" as const,
      quality: "hd",
      count: 1,
    };
    const key1 = computeCacheKey(params);
    const key2 = computeCacheKey(params);
    expect(key1).toBe(key2);
  });

  it("produces different hashes for different inputs", () => {
    const base = {
      topic: "hero banner",
      brand: "apexure",
      purpose: "blog-hero" as const,
      quality: "hd",
      count: 1,
    };
    const key1 = computeCacheKey(base);
    const key2 = computeCacheKey({ ...base, topic: "different topic" });
    expect(key1).not.toBe(key2);
  });

  it("normalizes undefined optional fields", () => {
    const withUndefined = computeCacheKey({
      topic: "test",
      brand: "apexure",
      purpose: "blog-hero",
      style: undefined,
      quality: "hd",
      dimensions: undefined,
      count: 1,
    });
    const withoutOptional = computeCacheKey({
      topic: "test",
      brand: "apexure",
      purpose: "blog-hero",
      quality: "hd",
      count: 1,
    });
    expect(withUndefined).toBe(withoutOptional);
  });

  it("produces different hashes when style differs", () => {
    const base = {
      topic: "test",
      brand: "apexure",
      purpose: "blog-hero" as const,
      quality: "hd",
      count: 1,
    };
    const key1 = computeCacheKey({ ...base, style: "photographic" });
    const key2 = computeCacheKey({ ...base, style: "illustration" });
    expect(key1).not.toBe(key2);
  });

  it("includes oimg:imgcache: prefix", () => {
    const key = computeCacheKey({
      topic: "test",
      brand: "apexure",
      purpose: "blog-hero",
      quality: "hd",
      count: 1,
    });
    expect(key).toMatch(/^oimg:imgcache:[a-f0-9]{64}$/);
  });
});

describe("getCachedResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached data on hit", async () => {
    mockGet.mockResolvedValueOnce(sampleResult);
    const result = await getCachedResult("oimg:imgcache:abc");
    expect(result).toEqual(sampleResult);
    expect(mockGet).toHaveBeenCalledWith("oimg:imgcache:abc");
  });

  it("returns null on cache miss", async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await getCachedResult("oimg:imgcache:miss");
    expect(result).toBeNull();
  });

  it("returns null on Redis error (graceful degradation)", async () => {
    mockGet.mockRejectedValueOnce(new Error("connection refused"));
    const result = await getCachedResult("oimg:imgcache:err");
    expect(result).toBeNull();
  });
});

describe("setCachedResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores result with TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");
    await setCachedResult("oimg:imgcache:abc", sampleResult);
    expect(mockSet).toHaveBeenCalledWith(
      "oimg:imgcache:abc",
      sampleResult,
      { ex: expect.any(Number) },
    );
  });

  it("skips caching when payload exceeds size limit", async () => {
    const largeResult: CachedGenerateResult = {
      ...sampleResult,
      images: [
        {
          ...sampleResult.images[0],
          base64: "x".repeat(2_000_000), // ~2MB
        },
      ],
    };
    await setCachedResult("oimg:imgcache:big", largeResult);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("does not throw on Redis error", async () => {
    mockSet.mockRejectedValueOnce(new Error("connection refused"));
    await expect(
      setCachedResult("oimg:imgcache:err", sampleResult),
    ).resolves.toBeUndefined();
  });
});

describe("invalidateCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when key was deleted", async () => {
    mockDel.mockResolvedValueOnce(1);
    const result = await invalidateCache("oimg:imgcache:abc");
    expect(result).toBe(true);
  });

  it("returns false when key not found", async () => {
    mockDel.mockResolvedValueOnce(0);
    const result = await invalidateCache("oimg:imgcache:miss");
    expect(result).toBe(false);
  });
});

describe("getCachedResult with KV unavailable", () => {
  it("returns null when KV is not configured", async () => {
    // Override the mock to return null
    vi.doMock("@/lib/storage/kv", () => ({
      getKv: () => null,
      resetKv: vi.fn(),
    }));

    // Re-import to pick up the new mock
    const { getCachedResult: getCached } = await import(
      "@/lib/cache/result-cache"
    );
    const result = await getCached("oimg:imgcache:test");
    expect(result).toBeNull();

    // Restore
    vi.doUnmock("@/lib/storage/kv");
  });
});
