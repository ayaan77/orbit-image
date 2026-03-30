/**
 * Seed the initial admin user.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Required env vars:
 *   POSTGRES_URL     — Neon database URL
 *   ADMIN_USERNAME   — Admin username (default: admin)
 *   ADMIN_PASSWORD   — Admin password (required)
 */

import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

async function main() {
  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    console.error("Error: POSTGRES_URL is required");
    process.exit(1);
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Error: ADMIN_PASSWORD is required");
    process.exit(1);
  }

  const sql = neon(postgresUrl);
  const id = `usr_${randomBytes(12).toString("hex")}`;
  const passwordHash = hashPassword(password);

  try {
    // Check if admin already exists
    const existing = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`Admin user "${username}" already exists (id: ${existing[0].id}). Skipping.`);
      return;
    }

    await sql`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (${id}, ${username}, ${passwordHash}, 'admin')
    `;

    console.log(`Admin user created successfully:`);
    console.log(`  Username: ${username}`);
    console.log(`  ID: ${id}`);
    console.log(`  Role: admin`);
  } catch (err) {
    console.error("Failed to seed admin user:", err);
    process.exit(1);
  }
}

main();
