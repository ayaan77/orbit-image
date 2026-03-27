import { NextResponse } from "next/server";
import { z } from "zod";
import { checkIpRateLimit } from "@/lib/middleware/ip-rate-limit";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import { assemblePrompt } from "@/lib/prompt/engine";
import { getEnv } from "@/lib/config/env";
import { ImagePurpose, ImageStyle } from "@/types/api";

const PreviewRequestSchema = z.object({
  topic: z.string().min(1).max(500),
  purpose: ImagePurpose,
  brand: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
  style: ImageStyle.optional(),
});

/**
 * POST /api/studio/preview
 * Public endpoint — shows generic vs brand-aware prompt comparison.
 * No auth required. Rate-limited by IP (10 req/hour).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cors = corsHeaders(request);

  // IP-based rate limit: 10 previews per hour
  const rateLimited = checkIpRateLimit(request, 10, 3_600_000, "studio:preview");
  if (rateLimited) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: "Too many preview requests. Try again later." } },
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

  const parsed = PreviewRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request" } },
      { status: 400, headers: cors },
    );
  }

  const { topic, purpose, brand: brandOverride, style } = parsed.data;
  const brand = brandOverride ?? getEnv().DEFAULT_BRAND;

  // Generic prompt (no brand context)
  const genericBundle = assemblePrompt(
    { topic, purpose, style, count: 1, quality: "standard", output_format: "base64" },
    null,
  );

  // Brand-aware prompt
  let brandBundle = genericBundle;
  let brandContextUsed = false;
  let brandColors: unknown = null;
  let brandVoiceSummary: string | null = null;

  try {
    const cortex = createCachedCortexClient(brand);
    const { context } = await cortex.getBrandContext(brand, { topic });
    brandBundle = assemblePrompt(
      { topic, purpose, style, count: 1, quality: "standard", output_format: "base64" },
      context,
    );
    brandContextUsed = true;

    // Extract visual brand info for the UI
    const c = context.colours;
    if (c) {
      const colorEntries: Array<{ hex: string; role: string }> = [];
      for (const role of ["primary", "secondary", "dark", "highlight", "accent", "success"] as const) {
        if (c[role]?.hex) colorEntries.push({ hex: c[role].hex, role });
      }
      brandColors = colorEntries.length > 0 ? colorEntries : null;
    }
    const voiceRules = context.voice?.brand_voice_rules;
    if (voiceRules?.tone_spectrum) {
      brandVoiceSummary = voiceRules.tone_spectrum;
    }
  } catch (err) {
    if (!(err instanceof CortexError)) throw err;
    // Cortex unavailable — both prompts will be identical (generic)
  }

  return NextResponse.json(
    {
      success: true,
      generic: {
        positive: genericBundle.positive,
        negative: genericBundle.negative,
        dimensions: genericBundle.dimensions,
      },
      brandAware: {
        positive: brandBundle.positive,
        negative: brandBundle.negative,
        dimensions: brandBundle.dimensions,
      },
      brandContext: {
        used: brandContextUsed,
        brand,
        colors: brandColors,
        voiceTone: brandVoiceSummary,
      },
    },
    { headers: cors },
  );
}

export function OPTIONS(request: Request): NextResponse {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}
