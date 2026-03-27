import { getDb } from "@/lib/storage/db";
import { createLogger } from "@/lib/logging/logger";
import type { UsageEntry } from "./types";

/**
 * Get total spend for a client in the current calendar month.
 * Returns 0 if Postgres is not configured or query fails (never blocks generation).
 */
export async function getMonthlySpend(clientId: string): Promise<number> {
  try {
    const sql = getDb();
    if (!sql) return 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const rows = await sql`
      SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
      FROM usage_logs
      WHERE client_id = ${clientId}
        AND created_at >= ${monthStart.toISOString()}
    `;

    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Log a usage entry to Postgres.
 * Never throws — usage logging must never break generation.
 */
export async function logUsage(entry: UsageEntry): Promise<void> {
  try {
    const sql = getDb();
    if (!sql) return; // Postgres not configured, skip silently

    await sql`
      INSERT INTO usage_logs (
        client_id, client_name, brand, purpose, style,
        image_count, quality, estimated_cost_usd,
        processing_time_ms, cached, endpoint, created_at
      ) VALUES (
        ${entry.clientId}, ${entry.clientName}, ${entry.brand},
        ${entry.purpose}, ${entry.style ?? null},
        ${entry.imageCount}, ${entry.quality}, ${entry.estimatedCostUsd},
        ${entry.processingTimeMs}, ${entry.cached}, ${entry.endpoint},
        ${entry.timestamp.toISOString()}
      )
    `;
  } catch (error) {
    // Log but never throw — usage tracking is non-critical
    createLogger({ module: "usage" }).error("Failed to log usage", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
