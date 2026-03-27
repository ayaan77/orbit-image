import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import { assemblePrompt } from "@/lib/prompt/engine";
import { getEnv } from "@/lib/config/env";
import { GenerateRequestSchema } from "@/types/api";

/**
 * POST /api/admin/preview-prompt
 * Assembles the prompt that would be sent to the image provider
 * for the given request parameters — without generating anything.
 * Requires master key.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400, headers },
    );
  }

  const parsed = GenerateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request" } },
      { status: 400, headers },
    );
  }

  const body = parsed.data;
  const brand = body.brand ?? getEnv().DEFAULT_BRAND;

  // Fetch brand context (same as generate route — graceful fallback on Cortex error)
  let context = null;
  let brandContextUsed = false;
  try {
    const cortex = createCachedCortexClient(brand);
    const result = await cortex.getBrandContext(brand, {
      topic: body.topic,
      persona: body.persona,
      audience: body.audience,
      industry: body.industry,
    });
    context = result.context;
    brandContextUsed = true;
  } catch (err) {
    if (!(err instanceof CortexError)) throw err;
    // Cortex unavailable — assemble with fallback context
  }

  const bundle = assemblePrompt(body, context);

  return NextResponse.json(
    {
      success: true,
      prompt: {
        positive: bundle.positive,
        negative: bundle.negative,
        dimensions: bundle.dimensions,
        quality: bundle.quality,
        count: bundle.count,
      },
      brandContextUsed,
      brand,
    },
    { headers },
  );
}
