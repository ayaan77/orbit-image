import { NextResponse } from "next/server";
import { isAdmin, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";

/**
 * GET /api/admin/brands/:brandId — Fetch full brand context from Cortex.
 * Returns colors, voice, company, and personas for the given brand.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  const { brandId } = await params;

  if (!brandId || !/^[a-z0-9-]+$/.test(brandId)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BRAND", message: "Invalid brand ID" } },
      { status: 400, headers },
    );
  }

  try {
    const cortex = createCachedCortexClient();

    const [colours, voice, company, personas] = await Promise.allSettled([
      cortex.getColours(brandId),
      cortex.getBrandVoice(brandId),
      cortex.getCompany(brandId),
      cortex.getPersonas(brandId),
    ]);

    return NextResponse.json(
      {
        success: true,
        brand: brandId,
        context: {
          colours: colours.status === "fulfilled" ? colours.value : null,
          voice: voice.status === "fulfilled" ? voice.value : null,
          company: company.status === "fulfilled" ? company.value : null,
          personas: personas.status === "fulfilled" ? personas.value : null,
        },
      },
      { headers },
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CORTEX_ERROR",
          message: err instanceof Error ? err.message : "Failed to fetch brand context",
        },
      },
      { status: 502, headers },
    );
  }
}
