import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { getDb } from "@/lib/storage/db";
import { getKv } from "@/lib/storage/kv";

/**
 * GET /api/admin/webhook-logs?clientId=xxx&limit=20
 * Returns recent webhook delivery attempts for a client.
 * Looks up the client's defaultWebhookUrl from Redis, then queries
 * webhook_deliveries by URL.
 * Requires master key.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 50);

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "clientId is required" } },
      { status: 400, headers },
    );
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "Postgres not configured" } },
      { status: 503, headers },
    );
  }

  // Look up client's webhook URL from Redis
  const kv = getKv();
  let webhookUrl: string | null = null;
  if (kv) {
    try {
      const hash = await kv.hget<string>("oimg:clients", clientId);
      if (hash) {
        const client = await kv.get<{ defaultWebhookUrl?: string }>(
          `oimg:keys:${hash}`,
        );
        webhookUrl = client?.defaultWebhookUrl ?? null;
      }
    } catch {
      // proceed without URL filter
    }
  }

  try {
    const rows = webhookUrl
      ? await sql`
          SELECT job_id, url, status, attempts, last_attempt_at, response_status, error
          FROM webhook_deliveries
          WHERE url = ${webhookUrl}
          ORDER BY last_attempt_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT job_id, url, status, attempts, last_attempt_at, response_status, error
          FROM webhook_deliveries
          WHERE job_id IN (
            SELECT id FROM jobs WHERE client_id = ${clientId}
          )
          ORDER BY last_attempt_at DESC
          LIMIT ${limit}
        `;

    return NextResponse.json(
      {
        success: true,
        logs: rows.map((r) => ({
          jobId: r.job_id as string,
          url: r.url as string,
          status: r.status as string,
          attempts: r.attempts as number,
          lastAttemptAt: r.last_attempt_at
            ? (r.last_attempt_at as Date).toISOString()
            : null,
          responseStatus: r.response_status as number | null,
          error: r.error as string | null,
        })),
        webhookUrl,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: "Failed to query webhook logs" } },
      { status: 500, headers },
    );
  }
}
