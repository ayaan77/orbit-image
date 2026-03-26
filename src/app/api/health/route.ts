import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { authResultToResponse } from "@/lib/middleware/auth-helpers";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";

interface HealthStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly cortex: { readonly reachable: boolean };
  readonly openai: { readonly configured: boolean };
  readonly timestamp: string;
}

/** CORS preflight */
export function OPTIONS(request: Request) {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}

export async function GET(request: Request): Promise<NextResponse<HealthStatus | { success: false; error: { code: string; message: string } }>> {
  const requestId = getRequestId(request);
  const headers = { ...requestIdHeaders(requestId), ...corsHeaders(request) };

  const authResult = await authenticateRequest(request);
  const authError = authResultToResponse(authResult);
  if (authError) {
    Object.entries(headers).forEach(([k, v]) => authError.headers.set(k, v));
    return authError;
  }

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

  return NextResponse.json(
    {
      status,
      cortex: { reachable: cortexReachable },
      openai: { configured: openaiConfigured },
      timestamp: new Date().toISOString(),
    },
    { headers },
  );
}
