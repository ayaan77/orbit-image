import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { authResultToResponse } from "@/lib/middleware/auth-helpers";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import type { ErrorResponse } from "@/types/api";

/** CORS preflight */
export function OPTIONS(request: Request) {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}

export async function GET(
  request: Request
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const headers = { ...requestIdHeaders(requestId), ...corsHeaders(request) };

  const authResult = await authenticateRequest(request);
  const authError = authResultToResponse(authResult);
  if (authError) {
    Object.entries(headers).forEach(([k, v]) => authError.headers.set(k, v));
    return authError;
  }

  try {
    const cortex = createCachedCortexClient();
    const brands = await cortex.listBrands();

    return NextResponse.json(
      {
        success: true,
        brands: brands.map((b) => ({
          id: b.id,
          active: b.active,
        })),
      },
      { headers },
    );
  } catch (error) {
    console.error(`[brands] [${requestId}] Error:`, error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CORTEX_ERROR",
          message: "Failed to fetch brands. Please try again.",
        },
      } satisfies ErrorResponse,
      { status: 502, headers },
    );
  }
}
