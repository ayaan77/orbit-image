import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { flushImageCache, invalidateCache } from "@/lib/cache/result-cache";

/**
 * Admin cache management — protected by master key only.
 *
 * DELETE /api/admin/cache         — flush all image cache entries
 * DELETE /api/admin/cache?key=X   — invalidate a specific cache entry
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (key) {
    const deleted = await invalidateCache(key);
    return NextResponse.json(
      {
        success: true,
        message: deleted ? "Cache entry invalidated" : "Cache entry not found",
        deleted: deleted ? 1 : 0,
      },
      { headers },
    );
  }

  const deleted = await flushImageCache();
  return NextResponse.json(
    {
      success: true,
      message: `Flushed ${deleted} cache entries`,
      deleted,
    },
    { headers },
  );
}
