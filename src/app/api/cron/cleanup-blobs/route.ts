import { NextResponse } from "next/server";
import { cleanupExpiredBlobs } from "@/lib/mcp/blob";

/**
 * Cron endpoint to clean up expired blob uploads.
 * Configure in vercel.json: { "crons": [{ "path": "/api/cron/cleanup-blobs", "schedule": "0 3 * * *" }] }
 *
 * Protected by Vercel's CRON_SECRET header in production.
 */
export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron secret — fail closed when not configured
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupExpiredBlobs();

  return NextResponse.json({
    success: true,
    ...result,
  });
}
