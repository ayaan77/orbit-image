import { getDb } from "@/lib/storage/db";
import { createLogger } from "@/lib/logging/logger";
import type { UsageEntry } from "./types";

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
