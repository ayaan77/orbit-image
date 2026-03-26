import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/storage/db";
import { createLogger } from "@/lib/logging/logger";
import type { Job } from "./types";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 5_000, 15_000] as const;
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 */
function signPayload(payload: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

/**
 * Log a webhook delivery attempt to Postgres.
 * Never throws — logging must not break delivery flow.
 */
async function logWebhookDelivery(entry: {
  readonly jobId: string;
  readonly url: string;
  readonly status: "pending" | "delivered" | "failed";
  readonly attempts: number;
  readonly responseStatus?: number;
  readonly error?: string;
}): Promise<void> {
  try {
    const sql = getDb();
    if (!sql) return;

    await sql`
      INSERT INTO webhook_deliveries (
        job_id, url, status, attempts, last_attempt_at,
        response_status, error
      ) VALUES (
        ${entry.jobId}, ${entry.url}, ${entry.status},
        ${entry.attempts}, NOW(),
        ${entry.responseStatus ?? null}, ${entry.error ?? null}
      )
      ON CONFLICT (job_id) DO UPDATE SET
        status = EXCLUDED.status,
        attempts = EXCLUDED.attempts,
        last_attempt_at = EXCLUDED.last_attempt_at,
        response_status = EXCLUDED.response_status,
        error = EXCLUDED.error
    `;
  } catch (error) {
    createLogger({ module: "webhook" }).error("Failed to log delivery", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Query webhook delivery status for a job.
 */
export async function getWebhookDeliveryStatus(
  jobId: string,
): Promise<{
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  responseStatus: number | null;
  error: string | null;
} | null> {
  try {
    const sql = getDb();
    if (!sql) return null;

    const rows = await sql`
      SELECT status, attempts, last_attempt_at, response_status, error
      FROM webhook_deliveries
      WHERE job_id = ${jobId}
      LIMIT 1
    `;

    if (!rows.length) return null;

    const row = rows[0];
    return {
      status: row.status as string,
      attempts: row.attempts as number,
      lastAttemptAt: row.last_attempt_at
        ? (row.last_attempt_at as Date).toISOString()
        : null,
      responseStatus: row.response_status as number | null,
      error: row.error as string | null,
    };
  } catch {
    return null;
  }
}

/**
 * Deliver a webhook for a completed/failed job.
 * Retries up to 3 times with exponential backoff.
 * Logs delivery status to Postgres for audit trail.
 * Never throws — logs errors internally.
 */
export async function deliverWebhook(
  job: Job,
  secret: string,
): Promise<boolean> {
  if (!job.webhookUrl) return false;

  const log = createLogger({ jobId: job.id, module: "webhook", url: job.webhookUrl });
  const event =
    job.status === "completed"
      ? "generation.completed"
      : "generation.failed";

  const payload = JSON.stringify({
    event,
    job_id: job.id,
    timestamp: new Date().toISOString(),
    data:
      job.status === "completed"
        ? job.result
        : { error: job.error ?? "Unknown error" },
  });

  const signature = signPayload(payload, secret);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(job.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Orbit-Signature": signature,
          "X-Orbit-Event": event,
          "X-Orbit-Job-Id": job.id,
        },
        body: payload,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });

      if (response.ok) {
        await logWebhookDelivery({
          jobId: job.id,
          url: job.webhookUrl,
          status: "delivered",
          attempts: attempt + 1,
          responseStatus: response.status,
        });
        return true;
      }

      // 4xx client error — receiver rejected; retrying won't help
      if (response.status >= 400 && response.status < 500) {
        log.warn("Delivery rejected by receiver", { status: response.status });
        await logWebhookDelivery({
          jobId: job.id,
          url: job.webhookUrl,
          status: "failed",
          attempts: attempt + 1,
          responseStatus: response.status,
          error: `Receiver rejected with ${response.status}`,
        });
        return false;
      }

      // 5xx server error — retry
      log.warn(`Attempt ${attempt + 1} failed`, { status: response.status });
    } catch (err) {
      log.warn(`Attempt ${attempt + 1} error`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Wait before retry (unless last attempt)
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
      );
    }
  }

  log.error(`All ${MAX_RETRIES + 1} attempts failed`);
  await logWebhookDelivery({
    jobId: job.id,
    url: job.webhookUrl,
    status: "failed",
    attempts: MAX_RETRIES + 1,
    error: "All retry attempts exhausted",
  });
  return false;
}

/**
 * Verify an incoming webhook signature.
 * Useful for clients who want to verify Orbit Image webhooks.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signPayload(payload, secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
