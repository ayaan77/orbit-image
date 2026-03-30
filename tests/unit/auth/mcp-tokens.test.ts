import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock getDb ───
const mockDb = vi.fn();

vi.mock("@/lib/storage/db", () => ({
  getDb: () => mockDb,
}));

import {
  createMcpToken,
  lookupMcpToken,
  revokeMcpToken,
  deleteMcpToken,
  listMcpTokens,
} from "@/lib/auth/mcp-tokens";

// ─── Helpers ───

const NOW = new Date("2025-06-01T00:00:00Z");

function fakeTokenRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "tok_abc123",
    key_hash: "fakehash",
    name: "Test Token",
    created_by: "usr_admin1",
    active: true,
    rate_limit: null,
    scopes: null,
    default_webhook_url: null,
    monthly_budget_usd: null,
    created_at: NOW,
    ...overrides,
  };
}

// ─── Tests ───

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createMcpToken", () => {
  it("returns a raw key with oimg_live_ prefix", async () => {
    mockDb.mockResolvedValueOnce([fakeTokenRow()]);

    const { rawKey } = await createMcpToken("My Token", "usr_admin1");

    expect(rawKey).toMatch(/^oimg_live_[a-f0-9]{32}$/);
  });

  it("returns a mapped McpToken object", async () => {
    mockDb.mockResolvedValueOnce([fakeTokenRow()]);

    const { token } = await createMcpToken("My Token", "usr_admin1");

    expect(token.name).toBe("Test Token");
    expect(token.createdBy).toBe("usr_admin1");
    expect(token.active).toBe(true);
    expect(token.createdAt).toBe(NOW.toISOString());
  });

  it("stores a hash, not the raw key", async () => {
    mockDb.mockImplementationOnce((_strings: TemplateStringsArray, ...values: unknown[]) => {
      // values[1] is the key_hash param in the INSERT
      const storedHash = values[1] as string;
      // The hash should be a 64-char hex SHA-256, not an oimg_live_ prefixed key
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
      expect(storedHash).not.toContain("oimg_live_");
      return Promise.resolve([fakeTokenRow()]);
    });

    await createMcpToken("My Token", "usr_admin1");
  });

  it("passes optional scopes and rateLimit", async () => {
    mockDb.mockResolvedValueOnce([
      fakeTokenRow({ rate_limit: 50, scopes: ["generate", "brands"] }),
    ]);

    const { token } = await createMcpToken("Scoped Token", "usr_admin1", {
      rateLimit: 50,
      scopes: ["generate", "brands"],
    });

    expect(token.rateLimit).toBe(50);
    expect(token.scopes).toEqual(["generate", "brands"]);
  });

  it("generates unique raw keys on each call", async () => {
    mockDb.mockResolvedValue([fakeTokenRow()]);

    const { rawKey: key1 } = await createMcpToken("Token 1", "usr_admin1");
    const { rawKey: key2 } = await createMcpToken("Token 2", "usr_admin1");

    expect(key1).not.toBe(key2);
  });
});

describe("lookupMcpToken", () => {
  it("returns the token when found and active", async () => {
    mockDb.mockResolvedValueOnce([fakeTokenRow()]);

    // We need a validly formatted key so isValidKeyFormat passes
    const { generateApiKey } = await import("@/lib/auth/keys");
    const validKey = generateApiKey();

    const token = await lookupMcpToken(validKey);

    expect(token).not.toBeNull();
    expect(token!.name).toBe("Test Token");
  });

  it("returns null when no matching hash is found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const { generateApiKey } = await import("@/lib/auth/keys");
    const validKey = generateApiKey();

    const token = await lookupMcpToken(validKey);

    expect(token).toBeNull();
  });

  it("returns null when token is inactive", async () => {
    mockDb.mockResolvedValueOnce([fakeTokenRow({ active: false })]);

    const { generateApiKey } = await import("@/lib/auth/keys");
    const validKey = generateApiKey();

    const token = await lookupMcpToken(validKey);

    expect(token).toBeNull();
  });

  it("returns null for invalid key format without querying db", async () => {
    const token = await lookupMcpToken("not_a_valid_key");

    expect(token).toBeNull();
    expect(mockDb).not.toHaveBeenCalled();
  });
});

describe("revokeMcpToken", () => {
  it("returns true when the token is revoked", async () => {
    mockDb.mockResolvedValueOnce([{ id: "tok_abc123" }]);

    const result = await revokeMcpToken("tok_abc123");

    expect(result).toBe(true);
  });

  it("returns false when the token is not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const result = await revokeMcpToken("tok_missing");

    expect(result).toBe(false);
  });
});

describe("deleteMcpToken", () => {
  it("returns true when the token is deleted", async () => {
    mockDb.mockResolvedValueOnce([{ id: "tok_abc123" }]);

    const result = await deleteMcpToken("tok_abc123");

    expect(result).toBe(true);
  });

  it("returns false when the token is not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const result = await deleteMcpToken("tok_missing");

    expect(result).toBe(false);
  });
});

describe("listMcpTokens", () => {
  it("returns tokens and total count", async () => {
    mockDb
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        fakeTokenRow(),
        fakeTokenRow({ id: "tok_def456", name: "Second Token" }),
      ]);

    const result = await listMcpTokens();

    expect(result.total).toBe(2);
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0].name).toBe("Test Token");
    expect(result.tokens[1].name).toBe("Second Token");
  });

  it("filters by createdBy when provided", async () => {
    mockDb
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([fakeTokenRow()]);

    const result = await listMcpTokens({ createdBy: "usr_admin1" });

    expect(result.total).toBe(1);
    expect(result.tokens).toHaveLength(1);
    // Verify db was called twice (count + select) with the filter
    expect(mockDb).toHaveBeenCalledTimes(2);
  });

  it("returns empty results when no tokens exist", async () => {
    mockDb
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    const result = await listMcpTokens();

    expect(result.total).toBe(0);
    expect(result.tokens).toHaveLength(0);
  });
});
