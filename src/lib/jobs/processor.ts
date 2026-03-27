import { getGenerateQueue } from "@/lib/queue/concurrency-queue";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import type { BrandContext } from "@/lib/cortex/types";
import { assemblePrompt } from "@/lib/prompt/engine";
import { resolveModel } from "@/lib/providers/factory";
import { getEnv } from "@/lib/config/env";
import { updateJob, getJob } from "@/lib/jobs/store";
import type { Job } from "@/lib/jobs/types";
import { deliverWebhook } from "@/lib/jobs/webhook";
import { computeCacheKey, getCachedResult, setCachedResult } from "@/lib/cache/result-cache";
import type { CachedGenerateResult } from "@/lib/cache/result-cache";
import { uploadImageToBlob } from "@/lib/mcp/blob";
import { logUsage } from "@/lib/usage/logger";
import { estimateCost } from "@/lib/usage/cost";
import { createLogger } from "@/lib/logging/logger";
import type { GenerateRequest } from "@/types/api";

export async function generateImages(body: GenerateRequest, brand: string) {
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
    const { provider, internalModel } = resolveModel(body.model);
    const generatedImages = await provider.generate(promptBundle, internalModel);

    const images = generatedImages.map((img) => ({
      base64: img.data.toString("base64"),
      prompt: img.prompt,
      mimeType: img.mimeType,
      dimensions: img.dimensions,
    }));

    return { images, cached, cortexAvailable };
  });
}

async function tryDeliverWebhook(job: Job | null, jobId: string): Promise<void> {
  if (!job?.webhookUrl) return;
  const secret = getEnv().WEBHOOK_SECRET;
  if (!secret) {
    createLogger({ jobId, module: "async-job" }).warn(
      "webhookUrl configured but WEBHOOK_SECRET missing — skipping delivery",
    );
    return;
  }
  await deliverWebhook(job, secret);
}

/**
 * Background processor for async jobs.
 * Runs via after() — executes after the response is sent.
 */
export async function processAsyncJob(
  jobId: string,
  body: GenerateRequest,
  brand: string,
  clientId: string,
  clientName: string,
  startTime: number,
): Promise<void> {
  try {
    await updateJob(jobId, { status: "processing" });

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

      await setCachedResult(cacheKey, {
        images,
        brand,
        createdAt: new Date().toISOString(),
      });
    }

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

    const updatedJob = await updateJob(jobId, {
      status: "completed",
      result: {
        images: jobImages,
        brand,
        processingTimeMs,
        cortexDataCached: cached,
        resultCached: !!cacheHit,
      },
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
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    });

    const failedJob = await getJob(jobId);
    await tryDeliverWebhook(failedJob, jobId);
  }
}
