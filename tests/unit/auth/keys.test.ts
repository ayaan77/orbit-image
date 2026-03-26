import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  isValidKeyFormat,
} from "@/lib/auth/keys";

describe("generateApiKey", () => {
  it("returns a key with oimg_live_ prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("oimg_live_")).toBe(true);
  });

  it("returns a 42-character key", () => {
    const key = generateApiKey();
    expect(key.length).toBe(42);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
    expect(keys.size).toBe(10);
  });
});

describe("hashApiKey", () => {
  it("returns a 64-character hex hash", () => {
    const hash = hashApiKey("oimg_live_abc123");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    const key = "oimg_live_test1234567890abcdef12345";
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it("produces different hashes for different keys", () => {
    const h1 = hashApiKey("oimg_live_aaaa");
    const h2 = hashApiKey("oimg_live_bbbb");
    expect(h1).not.toBe(h2);
  });
});

describe("isValidKeyFormat", () => {
  it("returns true for valid key format", () => {
    const key = generateApiKey();
    expect(isValidKeyFormat(key)).toBe(true);
  });

  it("returns false for wrong prefix", () => {
    expect(isValidKeyFormat("wrong_prefix_abcdef1234567890abcdef")).toBe(false);
  });

  it("returns false for wrong length", () => {
    expect(isValidKeyFormat("oimg_live_short")).toBe(false);
  });
});
