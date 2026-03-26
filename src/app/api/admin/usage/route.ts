import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { getDb } from "@/lib/storage/db";

/**
 * Admin usage query — protected by master key only.
 *
 * GET /api/admin/usage?clientId=...&brand=...&from=...&to=...&limit=...&offset=...
 */

function isMasterKey(request: Request): Promise<boolean> {
  return authenticateRequest(request).then((r) => r.type === "master");
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "Master key required" } },
    { status: 401 }
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await isMasterKey(request))) return unauthorized();

  const sql = getDb();
  if (!sql) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "POSTGRES_URL is not configured" } },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const brand = url.searchParams.get("brand");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 50;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  // Parse date filters (null means no filter)
  const fromDate = from ? new Date(from).toISOString() : null;
  const toDate = to ? new Date(to).toISOString() : null;

  try {
    // Use tagged templates with always-present conditions (NULL = no filter)
    const [rows, countResult] = await Promise.all([
      sql`SELECT id, client_id, client_name, brand, purpose, style, image_count,
                 quality, estimated_cost_usd, processing_time_ms, cached, endpoint, created_at
          FROM usage_logs
          WHERE (${clientId}::text IS NULL OR client_id = ${clientId})
            AND (${brand}::text IS NULL OR brand = ${brand})
            AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate}::timestamptz)
            AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate}::timestamptz)
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`,
      sql`SELECT COUNT(*)::int AS total,
                 COALESCE(SUM(estimated_cost_usd), 0) AS total_cost,
                 COALESCE(SUM(image_count), 0)::int AS total_images
          FROM usage_logs
          WHERE (${clientId}::text IS NULL OR client_id = ${clientId})
            AND (${brand}::text IS NULL OR brand = ${brand})
            AND (${fromDate}::timestamptz IS NULL OR created_at >= ${fromDate}::timestamptz)
            AND (${toDate}::timestamptz IS NULL OR created_at <= ${toDate}::timestamptz)`,
    ]);

    const summary = countResult[0] as { total: number; total_cost: number; total_images: number };

    return NextResponse.json({
      success: true,
      usage: rows,
      pagination: {
        total: summary.total,
        limit,
        offset,
      },
      summary: {
        totalCostUsd: Number(summary.total_cost),
        totalImages: summary.total_images,
      },
    });
  } catch (error) {
    console.error("[admin/usage] Query error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to query usage logs" } },
      { status: 500 }
    );
  }
}
