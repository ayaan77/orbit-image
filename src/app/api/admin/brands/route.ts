import { NextResponse } from "next/server";
import { isAdmin, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import {
  getConnectedBrands,
  connectBrand,
  disconnectBrand,
} from "@/lib/storage/brand-connections";
import { syncWorkspacesFromCortex } from "@/lib/chat/workspace";

/**
 * GET /api/admin/brands — List connected brands.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  const connections = await getConnectedBrands();
  return NextResponse.json({ success: true, connections }, { headers });
}

/**
 * POST /api/admin/brands — Connect or disconnect a brand.
 * Body: { brandId: string, connected: boolean }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isAdmin(request))) return unauthorizedResponse(headers);

  let body: { brandId?: string; connected?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_JSON", message: "Invalid request body" } },
      { status: 400, headers },
    );
  }

  const { brandId, connected } = body;

  if (!brandId || typeof brandId !== "string") {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_BRAND_ID", message: "brandId is required" } },
      { status: 400, headers },
    );
  }

  if (typeof connected !== "boolean") {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_CONNECTED", message: "connected (boolean) is required" } },
      { status: 400, headers },
    );
  }

  if (connected) {
    const result = await connectBrand(brandId);
    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "Failed to connect brand. Is Postgres configured?" } },
        { status: 500, headers },
      );
    }
    // Fire-and-forget workspace sync — do not fail brand connection if sync fails
    syncWorkspacesFromCortex().catch((err: unknown) => {
      console.error("[admin/brands] workspace sync failed after brand connect", err);
    });

    return NextResponse.json({ success: true, connection: result }, { headers });
  }

  const ok = await disconnectBrand(brandId);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: "Failed to disconnect brand. Is Postgres configured?" } },
      { status: 500, headers },
    );
  }

  return NextResponse.json({ success: true }, { headers });
}
