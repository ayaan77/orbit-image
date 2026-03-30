import { randomBytes } from "crypto";
import { getDb } from "@/lib/storage/db";
import type { User } from "./types";

const SESSION_TTL_DAYS = 7;

function generateSessionId(): string {
  return randomBytes(32).toString("hex"); // 64 hex chars
}

/**
 * Create a new session for a user. Returns the session ID (token).
 */
export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("Database not configured. Set POSTGRES_URL.");

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()})
  `;

  return sessionId;
}

/**
 * Look up a session and return the associated user.
 * Returns null if session not found, expired, or user inactive.
 */
export async function getSession(
  sessionId: string,
): Promise<User | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db`
    SELECT u.id, u.username, u.email, u.role, u.rate_limit,
           u.monthly_budget_usd, u.active, u.created_at, u.updated_at,
           s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  const expiresAt = new Date(row.expires_at as string);

  // Expired session — clean it up
  if (expiresAt < new Date()) {
    await db`DELETE FROM sessions WHERE id = ${sessionId}`;
    return null;
  }

  // Inactive user
  if (!row.active) return null;

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

/**
 * Delete a single session (logout).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db`DELETE FROM sessions WHERE id = ${sessionId}`;
}

/**
 * Delete all sessions for a user (force logout everywhere).
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db`DELETE FROM sessions WHERE user_id = ${userId}`;
}

/**
 * Clean up expired sessions (call periodically or on login).
 */
export async function cleanExpiredSessions(): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  const rows = await db`
    DELETE FROM sessions WHERE expires_at < NOW() RETURNING id
  `;
  return rows.length;
}

/**
 * Extract the session ID from a request's cookies.
 */
export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)orbit-session=([^;]+)/);
  const id = match ? match[1] : null;
  // Session IDs are 64 hex chars — reject anything else to avoid unnecessary DB lookups
  return id && /^[0-9a-f]{64}$/.test(id) ? id : null;
}

/**
 * Build the Set-Cookie header value for a session.
 */
export function buildSessionCookie(sessionId: string): string {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  return `orbit-session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * Build the Set-Cookie header value to clear the session.
 */
export function buildClearSessionCookie(): string {
  return "orbit-session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}
