import { createHmac, timingSafeEqual } from "crypto";
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
 * Deliver a webhook for a completed/failed job.
 * Retries up to 3 times with exponential backoff.
 * Never throws — logs errors internally.
 */
export async function deliverWebhook(
  job: Job,
  secret: string,
): Promise<boolean> {
  if (!job.webhookUrl) return false;

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
        return true;
      }

      // 4xx client error — receiver rejected; retrying won't help
      if (response.status >= 400 && response.status < 500) {
        console.warn(
          `[webhook] Delivery rejected by receiver for job ${job.id}: ${response.status}`,
        );
        return false;
      }

      // 5xx server error — retry
      console.warn(
        `[webhook] Attempt ${attempt + 1} failed for job ${job.id}: ${response.status}`,
      );
    } catch (err) {
      console.warn(
        `[webhook] Attempt ${attempt + 1} error for job ${job.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Wait before retry (unless last attempt)
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
      );
    }
  }

  console.error(
    `[webhook] All ${MAX_RETRIES + 1} attempts failed for job ${job.id} → ${job.webhookUrl}`,
  );
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
