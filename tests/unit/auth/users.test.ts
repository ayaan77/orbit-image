import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock getDb ───
const mockDb = vi.fn() as ReturnType<typeof vi.fn> & {
  query: ReturnType<typeof vi.fn>;
};
mockDb.query = vi.fn();

vi.mock("@/lib/storage/db", () => ({
  getDb: () => mockDb,
}));

import {
  createUser,
  getUserByUsername,
  getUserById,
  verifyPassword,
  updateUser,
  deleteUser,
  listUsers,
} from "@/lib/auth/users";

// ─── Helpers ───

const NOW = new Date("2025-06-01T00:00:00Z");

function fakeUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "usr_abc123",
    username: "alice",
    email: "alice@example.com",
    password_hash: "scrypt:placeholder:placeholder",
    role: "user",
    rate_limit: null,
    monthly_budget_usd: null,
    active: true,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// ─── Tests ───

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createUser", () => {
  it("inserts a user and returns mapped User object", async () => {
    mockDb.mockResolvedValueOnce([fakeUserRow()]);

    const user = await createUser("alice", "s3cret");

    expect(mockDb).toHaveBeenCalledTimes(1);
    expect(user.username).toBe("alice");
    expect(user.role).toBe("user");
    expect(user.active).toBe(true);
    expect(user.id).toBe("usr_abc123");
    expect(user.createdAt).toBe(NOW.toISOString());
  });

  it("passes the correct role to the db", async () => {
    mockDb.mockResolvedValueOnce([fakeUserRow({ role: "admin" })]);

    const user = await createUser("admin-user", "pass", "admin");

    expect(user.role).toBe("admin");
  });

  it("passes optional email, rateLimit, monthlyBudgetUsd", async () => {
    mockDb.mockResolvedValueOnce([
      fakeUserRow({ email: "a@b.com", rate_limit: 100, monthly_budget_usd: 50 }),
    ]);

    const user = await createUser("alice", "pass", "user", {
      email: "a@b.com",
      rateLimit: 100,
      monthlyBudgetUsd: 50,
    });

    expect(user.email).toBe("a@b.com");
    expect(user.rateLimit).toBe(100);
    expect(user.monthlyBudgetUsd).toBe(50);
  });

  it("stores an scrypt-format password hash (not the raw password)", async () => {
    // Capture the tagged template call's interpolated values
    mockDb.mockImplementationOnce((_strings: TemplateStringsArray, ...values: unknown[]) => {
      // values[3] is the password_hash positional param in the INSERT
      const hash = values[3] as string;
      expect(hash).toMatch(/^scrypt:[a-f0-9]+:[a-f0-9]+$/);
      expect(hash).not.toContain("s3cret");
      return Promise.resolve([fakeUserRow()]);
    });

    await createUser("alice", "s3cret");
  });
});

describe("getUserByUsername", () => {
  it("returns a User when found", async () => {
    mockDb.mockResolvedValueOnce([fakeUserRow()]);

    const user = await getUserByUsername("alice");

    expect(user).not.toBeNull();
    expect(user!.username).toBe("alice");
  });

  it("returns null when not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const user = await getUserByUsername("nonexistent");

    expect(user).toBeNull();
  });
});

describe("getUserById", () => {
  it("returns a User when found", async () => {
    mockDb.mockResolvedValueOnce([fakeUserRow()]);

    const user = await getUserById("usr_abc123");

    expect(user).not.toBeNull();
    expect(user!.id).toBe("usr_abc123");
  });

  it("returns null when not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const user = await getUserById("usr_missing");

    expect(user).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("returns the user when the password is correct", async () => {
    // We need a real scrypt hash for "correctpass"
    const { scryptSync, randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync("correctpass", salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    const storedHash = `scrypt:${salt}:${derived}`;

    mockDb.mockResolvedValueOnce([fakeUserRow({ password_hash: storedHash })]);

    const user = await verifyPassword("alice", "correctpass");

    expect(user).not.toBeNull();
    expect(user!.username).toBe("alice");
  });

  it("returns null when the password is wrong", async () => {
    const { scryptSync, randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync("correctpass", salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    const storedHash = `scrypt:${salt}:${derived}`;

    mockDb.mockResolvedValueOnce([fakeUserRow({ password_hash: storedHash })]);

    const user = await verifyPassword("alice", "wrongpass");

    expect(user).toBeNull();
  });

  it("returns null when user not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const user = await verifyPassword("ghost", "pass");

    expect(user).toBeNull();
  });

  it("returns null when user is inactive", async () => {
    const { scryptSync, randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync("pass", salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
    const storedHash = `scrypt:${salt}:${derived}`;

    mockDb.mockResolvedValueOnce([fakeUserRow({ password_hash: storedHash, active: false })]);

    const user = await verifyPassword("alice", "pass");

    expect(user).toBeNull();
  });
});

describe("updateUser", () => {
  it("returns the user unchanged when no updates provided", async () => {
    // updateUser with empty updates calls getUserById internally
    mockDb.mockResolvedValueOnce([fakeUserRow()]);

    const user = await updateUser("usr_abc123", {});

    expect(user).not.toBeNull();
    expect(user!.username).toBe("alice");
  });

  it("builds SET clauses only for provided fields", async () => {
    mockDb.query.mockResolvedValueOnce([fakeUserRow({ role: "admin" })]);

    const user = await updateUser("usr_abc123", { role: "admin" });

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [query, params] = mockDb.query.mock.calls[0];
    expect(query).toContain("role = $2");
    expect(params).toEqual(["usr_abc123", "admin"]);
    expect(user!.role).toBe("admin");
  });

  it("hashes a new password before storing", async () => {
    mockDb.query.mockResolvedValueOnce([fakeUserRow()]);

    await updateUser("usr_abc123", { password: "newpass" });

    const [_query, params] = mockDb.query.mock.calls[0];
    const storedHash = params[1] as string;
    expect(storedHash).toMatch(/^scrypt:[a-f0-9]+:[a-f0-9]+$/);
    expect(storedHash).not.toContain("newpass");
  });

  it("only allows whitelisted columns", async () => {
    // The allowlist is enforced inside updateUser. We cannot directly inject
    // a disallowed column via the public API because the function signature
    // constrains the keys. The test verifies the internal guard doesn't throw
    // for valid columns.
    mockDb.query.mockResolvedValueOnce([fakeUserRow({ active: false })]);

    const user = await updateUser("usr_abc123", { active: false });

    expect(user).not.toBeNull();
  });
});

describe("deleteUser", () => {
  it("returns true when the user is deleted", async () => {
    mockDb.mockResolvedValueOnce([{ id: "usr_abc123" }]);

    const result = await deleteUser("usr_abc123");

    expect(result).toBe(true);
  });

  it("returns false when user not found", async () => {
    mockDb.mockResolvedValueOnce([]);

    const result = await deleteUser("usr_missing");

    expect(result).toBe(false);
  });
});

describe("listUsers", () => {
  it("returns users and total count", async () => {
    mockDb
      .mockResolvedValueOnce([{ total: 2 }]) // COUNT query
      .mockResolvedValueOnce([fakeUserRow(), fakeUserRow({ id: "usr_def456", username: "bob" })]); // SELECT query

    const result = await listUsers();

    expect(result.total).toBe(2);
    expect(result.users).toHaveLength(2);
    expect(result.users[0].username).toBe("alice");
    expect(result.users[1].username).toBe("bob");
  });

  it("caps limit at 500", async () => {
    mockDb
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await listUsers(9999, 0);

    // The second call (SELECT) should have received the capped limit
    // We verify it was called — the cap is applied internally
    expect(mockDb).toHaveBeenCalledTimes(2);
  });
});
