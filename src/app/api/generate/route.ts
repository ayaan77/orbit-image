import { NextResponse } from "next/server";
import { after } from "next/server";
import { authenticateRequest } from "@/lib/middleware/auth";
import { authResultToResponse } from "@/lib/middleware/auth-helpers";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/middleware/rate-limit";
import { validateRequestBody } from "@/lib/middleware/validation";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";
import { GenerateRequestSchema } from "@/types/api";
import type {
  GenerateRequest,
  GenerateResponse,
  AsyncGenerateResponse,
  ErrorResponse,
} from "@/types/api";
import { CortexError } from "@/lib/cortex/client";
import { uploadImageToBlob } from "@/lib/mcp/blob";
import { ProviderError } from "@/lib/providers/types";
import { getEnv } from "@/lib/config/env";
import { logUsage, getMonthlySpend } from "@/lib/usage/logger";
import { estimateCost } from "@/lib/usage/cost";
import { createJob } from "@/lib/jobs/store";
import { QueueTimeoutError } from "@/lib/queue/errors";
import { computeCacheKey, getCachedResult, setCachedResult } from "@/lib/cache/result-cache";
import { createLogger } from "@/lib/logging/logger";
import type { CachedGenerateResult } from "@/lib/cache/result-cache";
import { generateImages, processAsyncJob } from "@/lib/jobs/processor";

export const maxDuration = 60;

/** CORS preflight */
export function OPTIONS(request: Request) {
  return handlePreflight(request) ?? new NextResponse(null, { status: 204 });
}

/** Build common response headers (request ID + CORS + rate limit). */
async function commonHeaders(
  request: Request,
  requestId: string,
  clientRateLimit?: number,
): Promise<Record<string, string>> {
  return {
    ...requestIdHeaders(requestId),
    ...corsHeaders(request),
    ...(await getRateLimitHeaders(request, clientRateLimit)),
  };
}


export async function POST(
  request: Request,
): Promise<
  NextResponse<GenerateResponse | AsyncGenerateResponse | ErrorResponse>
> {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  const baseHeaders = () => requestIdHeaders(requestId);

  // Auth
  const authResult = await authenticateRequest(request);
  const authError = authResultToResponse(authResult);
  if (authError) {
    // Attach request ID + CORS even to auth errors
    const h = { ...baseHeaders(), ...corsHeaders(request) };
    Object.entries(h).forEach(([k, v]) => authError.headers.set(k, v));
    return authError;
  }

  // Per-client rate limit
  const clientRateLimit =
    authResult.type === "client" ? authResult.client.rateLimit : undefined;
  const rateLimitError = await checkRateLimit(request, clientRateLimit);
  if (rateLimitError) {
    const h = { ...baseHeaders(), ...corsHeaders(request) };
    Object.entries(h).forEach(([k, v]) => rateLimitError.headers.set(k, v));
    return rateLimitError;
  }

  // Validate body
  const validation = await validateRequestBody(request, GenerateRequestSchema);
  if (!validation.success) {
    const h = await commonHeaders(request, requestId, clientRateLimit);
    Object.entries(h).forEach(([k, v]) => validation.response.headers.set(k, v));
    return validation.response;
  }

  const parsed = validation.data;
  // Zod applies defaults; ensure count/quality are set
  const body: GenerateRequest = {
    ...parsed,
    count: parsed.count ?? 1,
    quality: parsed.quality ?? "hd",
    output_format: parsed.output_format ?? "base64",
  };
  const brand = body.brand ?? getEnv().DEFAULT_BRAND;

  // Guard: blob URL output requires BLOB_READ_WRITE_TOKEN
  if (body.output_format === "url" && !getEnv().BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        success: false as const,
        error: {
          code: "BLOB_NOT_CONFIGURED",
          message:
            "output_format 'url' requires BLOB_READ_WRITE_TOKEN to be configured on the server.",
        },
      },
      { status: 503, headers: await commonHeaders(request, requestId, clientRateLimit) },
    );
  }

  const clientId =
    authResult.type === "client" ? authResult.client.clientId : "master";
  const clientName =
    authResult.type === "client" ? authResult.client.clientName : "master";

  // Brand scope check
  if (authResult.type === "client" && authResult.client.scopes?.length) {
    if (!authResult.client.scopes.includes(brand)) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "SCOPE_DENIED",
            message: `Your API key does not have access to brand "${brand}".`,
          },
        },
        { status: 403, headers: await commonHeaders(request, requestId, clientRateLimit) },
      );
    }
  }

  // Monthly budget cap (client keys only — skipped gracefully if Postgres unavailable)
  if (authResult.type === "client" && authResult.client.monthlyBudgetUsd !== undefined) {
    const spent = await getMonthlySpend(authResult.client.clientId);
    if (spent >= authResult.client.monthlyBudgetUsd) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "BUDGET_EXCEEDED",
            message: `Monthly budget of $${authResult.client.monthlyBudgetUsd.toFixed(2)} has been reached. Contact the administrator to increase the limit.`,
          },
        },
        { status: 429, headers: await commonHeaders(request, requestId, clientRateLimit) },
      );
    }
  }

  const headers = await commonHeaders(request, requestId, clientRateLimit);

  // ─── Async path ───
  if (body.async) {
    // Reject upfront if webhook is requested but secret is not configured
    if (body.webhook_url && !getEnv().WEBHOOK_SECRET) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "WEBHOOK_NOT_CONFIGURED",
            message:
              "Webhook delivery requires WEBHOOK_SECRET to be configured on the server.",
          },
        },
        { status: 503, headers },
      );
    }

    try {
      const job = await createJob({
        clientId,
        request: body,
        webhookUrl: body.webhook_url,
      });

      // Process in background after response is sent
      const baseUrl = new URL(request.url).origin;
      after(processAsyncJob(job.id, body, brand, clientId, clientName, startTime));

      return NextResponse.json(
        {
          success: true as const,
          async: true as const,
          jobId: job.id,
          statusUrl: `${baseUrl}/api/jobs/${job.id}`,
        },
        { headers },
      );
    } catch {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "ASYNC_UNAVAILABLE",
            message:
              "Async processing requires Redis. Use sync mode or configure KV storage.",
          },
        },
        { status: 503, headers },
      );
    }
  }

  // ─── Sync path ───
  const bypassCache = request.headers.get("X-Cache-Bypass") === "true";

  try {
    // Check image result cache first
    const cacheKey = computeCacheKey({
      topic: body.topic,
      brand,
      purpose: body.purpose,
      style: body.style,
      persona: body.persona,
      audience: body.audience,
      quality: body.quality,
      dimensions: body.dimensions,
      count: body.count,
    });

    const cacheHit = bypassCache ? null : await getCachedResult(cacheKey);

    if (cacheHit) {
      const processingTimeMs = Date.now() - startTime;

      // Blob upload for cached results when URL format requested
      let responseImages = cacheHit.images;
      if (body.output_format === "url") {
        responseImages = await Promise.all(
          cacheHit.images.map(async (img, i) => {
            const { url } = await uploadImageToBlob(
              img.base64,
              img.mimeType,
              `orbit/${brand}/${body.purpose}/${requestId}-${i}.png`,
            );
            return { ...img, url };
          }),
        );
      }

      after(
        logUsage({
          clientId,
          clientName,
          brand,
          purpose: body.purpose,
          style: body.style,
          imageCount: body.count,
          quality: body.quality,
          estimatedCostUsd: 0,
          processingTimeMs,
          cached: true,
          endpoint: "rest",
          timestamp: new Date(),
        }),
      );

      return NextResponse.json(
        {
          success: true as const,
          images: responseImages,
          brand,
          metadata: {
            processingTimeMs,
            cortexDataCached: true,
            cortexAvailable: true,
            resultCached: true,
          },
        },
        { headers },
      );
    }

    // Cache miss — generate via queue
    const { images, cached, cortexAvailable } = await generateImages(body, brand);
    const processingTimeMs = Date.now() - startTime;

    // Blob upload when URL format requested
    let responseImages = images;
    if (body.output_format === "url") {
      responseImages = await Promise.all(
        images.map(async (img, i) => {
          const { url } = await uploadImageToBlob(
            img.base64,
            img.mimeType,
            `orbit/${brand}/${body.purpose}/${requestId}-${i}.png`,
          );
          return { ...img, url };
        }),
      );
    }

    // Store base64 in cache (not URLs — they may expire)
    after(
      setCachedResult(cacheKey, {
        images,
        brand,
        createdAt: new Date().toISOString(),
      }),
    );

    after(
      logUsage({
        clientId,
        clientName,
        brand,
        purpose: body.purpose,
        style: body.style,
        imageCount: body.count,
        quality: body.quality,
        estimatedCostUsd: estimateCost(body.count, body.quality),
        processingTimeMs,
        cached,
        endpoint: "rest",
        timestamp: new Date(),
      }),
    );

    return NextResponse.json(
      {
        success: true as const,
        images: responseImages,
        brand,
        metadata: {
          processingTimeMs,
          cortexDataCached: cached,
          cortexAvailable,
          resultCached: false,
        },
      },
      { headers },
    );
  } catch (error) {
    const log = createLogger({ requestId, module: "generate" });
    log.error("Generation failed", { error: error instanceof Error ? error.message : String(error) });

    if (error instanceof QueueTimeoutError) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "QUEUE_TIMEOUT",
            message: "Server is busy. Please retry shortly.",
          },
        },
        { status: 503, headers },
      );
    }

    if (error instanceof CortexError) {
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "CORTEX_ERROR",
            message: "Failed to retrieve brand data. Please try again.",
          },
        },
        { status: 502, headers },
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
        { status: 502, headers },
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
      { status: 500, headers },
    );
  }
}

