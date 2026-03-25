import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";

interface HealthStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly cortex: { readonly reachable: boolean };
  readonly openai: { readonly configured: boolean };
  readonly timestamp: string;
}

export async function GET(request: Request): Promise<NextResponse<HealthStatus | { success: false; error: { code: string; message: string } }>> {
  const authError = authenticateRequest(request);
  if (authError) return authError;

  let cortexReachable = false;

  try {
    const cortex = createCachedCortexClient();
    const brands = await cortex.listBrands();
    cortexReachable = Array.isArray(brands) && brands.length > 0;
  } catch {
    cortexReachable = false;
  }

  let openaiConfigured = false;
  try {
    const { getEnv } = await import("@/lib/config/env");
    openaiConfigured = Boolean(getEnv().OPENAI_API_KEY);
  } catch {
    openaiConfigured = false;
  }

  const status: HealthStatus["status"] =
    cortexReachable && openaiConfigured
      ? "healthy"
      : cortexReachable || openaiConfigured
        ? "degraded"
        : "unhealthy";

  return NextResponse.json({
    status,
    cortex: { reachable: cortexReachable },
    openai: { configured: openaiConfigured },
    timestamp: new Date().toISOString(),
  });
}
