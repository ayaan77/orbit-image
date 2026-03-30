import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDb, resetDbCache } from "@/lib/storage/db";

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    const fn = Object.assign(vi.fn(), { query: vi.fn() });
    return fn;
  }),
}));

describe("getDb", () => {
  beforeEach(() => {
    resetDbCache();
    vi.unstubAllEnvs();
  });

  it("returns null when POSTGRES_URL is not set", () => {
    vi.stubEnv("POSTGRES_URL", "");
    resetDbCache();
    const db = getDb();
    expect(db).toBeNull();
  });

  it("returns a function when POSTGRES_URL is set", () => {
    vi.stubEnv("POSTGRES_URL", "postgresql://test:test@localhost/test");
    resetDbCache();
    const db = getDb();
    expect(db).not.toBeNull();
    expect(typeof db).toBe("function");
  });

  it("returns the same instance on subsequent calls (singleton)", () => {
    vi.stubEnv("POSTGRES_URL", "postgresql://test:test@localhost/test");
    resetDbCache();
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("returns fresh instance after resetDbCache", () => {
    vi.stubEnv("POSTGRES_URL", "postgresql://test:test@localhost/test");
    resetDbCache();
    const db1 = getDb();
    resetDbCache();
    const db2 = getDb();
    // Both are non-null but different instances
    expect(db1).not.toBeNull();
    expect(db2).not.toBeNull();
    expect(db1).not.toBe(db2);
  });
});
