import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import { assemblePrompt } from "@/lib/prompt/engine";
import { getEnv } from "@/lib/config/env";
import { resolveModel } from "@/lib/providers/factory";
import { ImagePurpose, ImageStyle } from "@/types/api";

const DemoRequestSchema = z.object({
  topic: z.string().min(1).max(500),
  purpose: ImagePurpose,
  style: ImageStyle.optional(),
});

/**
 * POST /api/studio/generate
 * Public demo endpoint — generates 1 standard-quality image, no auth.
 * Hard-capped: 3 generations per IP per day.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cors = corsHeaders(request);

  // IP-based rate limit: 3 generations per day (24h window)
  const rateLimited = checkIpRateLimit(request, 3, 86_400_000, "studio:generate");
  if (rateLimited) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "You've used all 3 free generations for today. Sign up for an API key for unlimited access.",
        },
      },
      { status: 429, headers: cors },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400, headers: cors },
    );
  }

  const parsed = DemoRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request" } },
      { status: 400, headers: cors },
    );
  }

  const { topic, purpose, style } = parsed.data;
  const brand = getEnv().DEFAULT_BRAND;
  const startTime = Date.now();

  // Fetch brand context
  let context = null;
  let brandContextUsed = false;
  try {
    const cortex = createCachedCortexClient(brand);
    const result = await cortex.getBrandContext(brand, { topic });
    context = result.context;
    brandContextUsed = true;
  } catch (err) {
    if (!(err instanceof CortexError)) throw err;
  }

  // Assemble prompt — forced: 1 image, standard quality
  const bundle = assemblePrompt(
    { topic, purpose, style, count: 1, quality: "standard", output_format: "base64" },
    context,
  );

  // Generate via configured provider
  try {
    const { provider, internalModel } = resolveModel();
    const images = await provider.generate(bundle, internalModel);
    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        images: images.map((img) => ({
          base64: img.data.toString("base64"),
          prompt: bundle.positive,
          mimeType: img.mimeType,
          dimensions: img.dimensions,
        })),
        brand,
        metadata: {
          processingTimeMs,
          cortexAvailable: brandContextUsed,
          demo: true,
        },
      },
      { headers: cors },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_ERROR", message } },
      { status: 502, headers: cors },
    );
  }
}

export const maxDuration = 60;

export function OPTIONS(request: Request): NextResponse {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}
