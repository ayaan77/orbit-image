import { describe, it, expect, vi } from "vitest";
import { logUsage } from "@/lib/usage/logger";
import type { UsageEntry } from "@/lib/usage/types";

// Mock @neondatabase/serverless
const mockSql = vi.fn().mockResolvedValue(undefined);
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

const sampleEntry: UsageEntry = {
  clientId: "client-123",
  clientName: "TestApp",
  brand: "apexure",
  purpose: "blog-hero",
  style: "minimalist",
  imageCount: 1,
  quality: "hd",
  estimatedCostUsd: 0.042,
  processingTimeMs: 1500,
  cached: false,
  endpoint: "mcp",
  timestamp: new Date("2026-03-26T00:00:00Z"),
};

describe("logUsage", () => {
  it("does not throw when POSTGRES_URL is not set", async () => {
    // POSTGRES_URL is not set in test env → getDb() returns null → skip silently
    await expect(logUsage(sampleEntry)).resolves.toBeUndefined();
  });

  it("does not throw even if sql throws", async () => {
    vi.stubEnv("POSTGRES_URL", "postgresql://fake");
    mockSql.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(logUsage(sampleEntry)).resolves.toBeUndefined();

    vi.unstubAllEnvs();
  });
});
