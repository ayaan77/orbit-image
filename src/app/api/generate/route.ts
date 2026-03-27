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
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import type { BrandContext } from "@/lib/cortex/types";
import { uploadImageToBlob } from "@/lib/mcp/blob";
import { ProviderError } from "@/lib/providers/types";
import { assemblePrompt } from "@/lib/prompt/engine";
import { getProvider } from "@/lib/providers/factory";
import { getEnv } from "@/lib/config/env";
import { logUsage } from "@/lib/usage/logger";
import { estimateCost } from "@/lib/usage/cost";
import { createJob, getJob, updateJob } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { deliverWebhook } from "@/lib/jobs/webhook";
import { getGenerateQueue } from "@/lib/queue/concurrency-queue";
import { QueueTimeoutError } from "@/lib/queue/errors";
import {
  computeCacheKey,
  getCachedResult,
  setCachedResult,
} from "@/lib/cache/result-cache";
import { createLogger } from "@/lib/logging/logger";
import type { CachedGenerateResult } from "@/lib/cache/result-cache";

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

async function generateImages(
  body: GenerateRequest,
  brand: string,
) {
  const env = getEnv();
  const queue = getGenerateQueue(
    env.MAX_CONCURRENT_GENERATES,
    env.GENERATE_QUEUE_TIMEOUT_MS,
  );

  return queue.enqueue(async () => {
    const cortex = createCachedCortexClient(brand);

    let context: BrandContext | null = null;
    let cached = false;
    let cortexAvailable = true;

    try {
      const result = await cortex.getBrandContext(brand, {
        topic: body.topic,
        persona: body.persona,
        audience: body.audience,
        industry: body.industry,
      });
      context = result.context;
      cached = result.cached;
    } catch (err) {
      if (err instanceof CortexError) {
        cortexAvailable = false;
      } else {
        throw err;
      }
    }

    const promptBundle = assemblePrompt(body, context);
    const provider = getProvider();
    const generatedImages = await provider.generate(promptBundle);

    const images = generatedImages.map((img) => ({
      base64: img.data.toString("base64"),
      prompt: img.prompt,
      mimeType: img.mimeType,
      dimensions: img.dimensions,
    }));

    return { images, cached, cortexAvailable };
  });
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

/** Deliver webhook for a job if configured. */
async function tryDeliverWebhook(job: Job | null, jobId: string): Promise<void> {
  if (!job?.webhookUrl) return;
  const secret = getEnv().WEBHOOK_SECRET;
  if (!secret) {
    const log = createLogger({ jobId, module: "async-job" });
    log.warn("webhookUrl configured but WEBHOOK_SECRET missing — skipping delivery");
    return;
  }
  await deliverWebhook(job, secret);
}

/**
 * Background processor for async jobs.
 * Runs via after() — executes after the response is sent.
 */
async function processAsyncJob(
  jobId: string,
  body: GenerateRequest,
  brand: string,
  clientId: string,
  clientName: string,
  startTime: number,
): Promise<void> {
  try {
    await updateJob(jobId, { status: "processing" });

    // Check cache for async jobs too
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

    const cacheHit = await getCachedResult(cacheKey);
    let images: CachedGenerateResult["images"];
    let cached: boolean;

    if (cacheHit) {
      images = cacheHit.images;
      cached = true;
    } else {
      const generated = await generateImages(body, brand);
      images = generated.images;
      cached = generated.cached;

      // Store base64 in cache (not URLs)
      await setCachedResult(cacheKey, {
        images,
        brand,
        createdAt: new Date().toISOString(),
      });
    }

    // Blob upload for async jobs when URL format requested
    let jobImages = images;
    if (body.output_format === "url" && getEnv().BLOB_READ_WRITE_TOKEN) {
      jobImages = await Promise.all(
        images.map(async (img, i) => {
          const { url } = await uploadImageToBlob(
            img.base64,
            img.mimeType,
            `orbit/${brand}/${body.purpose}/${jobId}-${i}.png`,
          );
          return { ...img, url };
        }),
      );
    }

    const processingTimeMs = Date.now() - startTime;

    const result = {
      images: jobImages,
      brand,
      processingTimeMs,
      cortexDataCached: cached,
      resultCached: !!cacheHit,
    };

    const updatedJob = await updateJob(jobId, {
      status: "completed",
      result,
    });

    await tryDeliverWebhook(updatedJob, jobId);

    await logUsage({
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
    });
  } catch (error) {
    createLogger({ jobId, module: "async-job" }).error("Async job failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    await updateJob(jobId, {
      status: "failed",
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    });

    const failedJob = await getJob(jobId);
    await tryDeliverWebhook(failedJob, jobId);
  }
}
