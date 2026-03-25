import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { validateRequestBody } from "@/lib/middleware/validation";
import { GenerateRequestSchema } from "@/types/api";
import type { GenerateResponse, ErrorResponse } from "@/types/api";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import { ProviderError } from "@/lib/providers/types";
import { assemblePrompt } from "@/lib/prompt/engine";
import { getProvider } from "@/lib/providers/factory";
import { getEnv } from "@/lib/config/env";

export const maxDuration = 60;

export async function POST(
  request: Request
): Promise<NextResponse<GenerateResponse | ErrorResponse>> {
  const startTime = Date.now();

  // Auth
  const authError = authenticateRequest(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitError = checkRateLimit(request);
  if (rateLimitError) return rateLimitError;

  // Validate body
  const validation = await validateRequestBody(request, GenerateRequestSchema);
  if (!validation.success) return validation.response;

  const body = validation.data;
  const brand = body.brand ?? getEnv().DEFAULT_BRAND;

  try {
    // Fetch brand context from Cortex
    const cortex = createCachedCortexClient(brand);
    const { context, cached } = await cortex.getBrandContext(brand, {
      topic: body.topic,
      persona: body.persona,
      industry: body.industry,
    });

    // Assemble prompt
    const requestWithDefaults = {
      ...body,
      count: body.count ?? 1,
      quality: body.quality ?? "hd" as const,
    };
    const promptBundle = assemblePrompt(requestWithDefaults, context);

    // Generate image
    const provider = getProvider();
    const generatedImages = await provider.generate(promptBundle);

    // Build response
    const images = generatedImages.map((img) => ({
      base64: img.data.toString("base64"),
      prompt: img.prompt,
      mimeType: img.mimeType,
      dimensions: img.dimensions,
    }));

    return NextResponse.json({
      success: true as const,
      images,
      brand,
      metadata: {
        processingTimeMs: Date.now() - startTime,
        cortexDataCached: cached,
      },
    });
  } catch (error) {
    console.error("[generate] Error:", error);

    if (error instanceof CortexError) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "CORTEX_ERROR",
            message: "Failed to retrieve brand data. Please try again.",
          },
        },
        { status: 502 }
      );
    }

    if (error instanceof ProviderError) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "PROVIDER_ERROR",
            message: "Image generation failed. Please try again.",
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "INTERNAL_ERROR",
          message: "An internal error occurred.",
        },
      },
      { status: 500 }
    );
  }
}
