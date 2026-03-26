import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { authResultToResponse } from "@/lib/middleware/auth-helpers";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import type { ErrorResponse } from "@/types/api";

export async function GET(
  request: Request
): Promise<NextResponse> {
  const authResult = await authenticateRequest(request);
  const authError = authResultToResponse(authResult);
  if (authError) return authError;

  try {
    const cortex = createCachedCortexClient();
    const brands = await cortex.listBrands();

    return NextResponse.json({
      success: true,
      brands: brands.map((b) => ({
        id: b.id,
        active: b.active,
      })),
    });
  } catch (error) {
    console.error("[brands] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CORTEX_ERROR",
          message: "Failed to fetch brands. Please try again.",
        },
      } satisfies ErrorResponse,
      { status: 502 }
    );
  }
}
