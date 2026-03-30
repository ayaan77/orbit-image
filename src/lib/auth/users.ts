import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/storage/db";
import type { User } from "./types";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

// ─── Password Hashing ───

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = parts[1];
  const expectedHash = parts[2];
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString("hex");

  // Timing-safe comparison
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── User CRUD ───

function generateUserId(): string {
  return `usr_${randomBytes(12).toString("hex")}`;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    email: (row.email as string) || undefined,
    role: row.role as "admin" | "user",
    rateLimit: row.rate_limit != null ? Number(row.rate_limit) : undefined,
    monthlyBudgetUsd: row.monthly_budget_usd != null ? Number(row.monthly_budget_usd) : undefined,
    active: row.active as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function createUser(
  username: string,
  password: string,
  role: "admin" | "user" = "user",
  opts?: {
    readonly email?: string;
    readonly rateLimit?: number;
    readonly monthlyBudgetUsd?: number;
  },
): Promise<User> {
  const db = getDb();
  if (!db) throw new Error("Database not configured. Set POSTGRES_URL.");

  const id = generateUserId();
  const passwordHash = hashPassword(password);

  const rows = await db`
    INSERT INTO users (id, username, email, password_hash, role, rate_limit, monthly_budget_usd)
    VALUES (${id}, ${username}, ${opts?.email ?? null}, ${passwordHash}, ${role}, ${opts?.rateLimit ?? null}, ${opts?.monthlyBudgetUsd ?? null})
    RETURNING *
  `;

  return rowToUser(rows[0]);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

/**
 * Verify a password against the stored hash for a given username.
 * Returns the User on success, null on failure.
 */
export async function verifyPassword(
  username: string,
  password: string,
): Promise<User | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
  if (rows.length === 0) return null;

  const row = rows[0];
  if (!row.active) return null;

  const valid = verifyPasswordHash(password, row.password_hash as string);
  if (!valid) return null;

  return rowToUser(row);
}

export async function updateUser(
  id: string,
  updates: {
    readonly username?: string;
    readonly email?: string | null;
    readonly role?: "admin" | "user";
    readonly rateLimit?: number | null;
    readonly monthlyBudgetUsd?: number | null;
    readonly active?: boolean;
    readonly password?: string;
  },
): Promise<User | null> {
  const db = getDb();
  if (!db) return null;

  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.username !== undefined) {
    sets.push("username");
    values.push(updates.username);
  }
  if (updates.email !== undefined) {
    sets.push("email");
    values.push(updates.email);
  }
  if (updates.role !== undefined) {
    sets.push("role");
    values.push(updates.role);
  }
  if (updates.rateLimit !== undefined) {
    sets.push("rate_limit");
    values.push(updates.rateLimit);
  }
  if (updates.monthlyBudgetUsd !== undefined) {
    sets.push("monthly_budget_usd");
    values.push(updates.monthlyBudgetUsd);
  }
  if (updates.active !== undefined) {
    sets.push("active");
    values.push(updates.active);
  }
  if (updates.password !== undefined) {
    sets.push("password_hash");
    values.push(hashPassword(updates.password));
  }

  if (sets.length === 0) return getUserById(id);

  // Build dynamic update — Neon tagged template doesn't support dynamic columns,
  // so we construct a safe parameterized query
  const setClauses = sets.map((col, i) => `${col} = $${i + 2}`).join(", ");
  const query = `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`;
  const rows = await db.query(query, [id, ...values]);

  return rows.length > 0 ? rowToUser(rows[0]) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const rows = await db`DELETE FROM users WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function listUsers(
  limit = 100,
  offset = 0,
): Promise<{ users: User[]; total: number }> {
  const db = getDb();
  if (!db) return { users: [], total: 0 };

  const safeLimit = Math.min(limit, 500);

  const [countResult, rows] = await Promise.all([
    db`SELECT COUNT(*)::int AS total FROM users`,
    db`SELECT * FROM users ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`,
  ]);

  return {
    users: rows.map(rowToUser),
    total: countResult[0].total as number,
  };
}
