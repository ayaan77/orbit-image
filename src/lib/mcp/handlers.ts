import type { JsonRpcSuccessResponse, JsonRpcErrorResponse } from "@/types/mcp";
import { GenerateImageParamsSchema } from "@/types/mcp";
import { ImagePurpose, ImageStyle } from "@/types/api";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { CortexError } from "@/lib/cortex/client";
import { assemblePrompt } from "@/lib/prompt/engine";
import { resolveModel } from "@/lib/providers/factory";
import { ProviderError } from "@/lib/providers/types";
import { getEnv } from "@/lib/config/env";
import { getJob } from "@/lib/jobs/store";
import { getGenerateQueue } from "@/lib/queue/concurrency-queue";
import { createLogger } from "@/lib/logging/logger";
import { uploadImageToBlob } from "./blob";
import {
  buildSuccessResponse,
  buildErrorResponse,
  INVALID_PARAMS,
  PROVIDER_ERROR,
  CORTEX_ERROR,
  INTERNAL_ERROR,
} from "./errors";
import { getDefaultDimensions } from "@/lib/prompt/templates";

// ─── list-styles ───

export function handleListStyles(
  id: string | number
): JsonRpcSuccessResponse {
  return buildSuccessResponse(id, {
    styles: ImageStyle.options.map((s) => ({
      name: s,
      description: styleDescriptions[s],
    })),
  });
}

const styleDescriptions: Record<string, string> = {
  photographic: "Photorealistic photography with natural lighting",
  illustration: "Modern digital illustration with clean lines",
  "3d-render": "3D rendered with volumetric lighting",
  "flat-design": "Flat design with bold shapes and minimal gradients",
  abstract: "Abstract art with geometric and flowing forms",
  minimalist: "Ultra-minimalist with maximum whitespace",
};

// ─── list-purposes ───

export function handleListPurposes(
  id: string | number
): JsonRpcSuccessResponse {
  return buildSuccessResponse(id, {
    purposes: ImagePurpose.options.map((p) => ({
      name: p,
      defaultDimensions: getDefaultDimensions(p),
    })),
  });
}

// ─── generate-image ───

export interface GenerateImageMeta {
  readonly brand: string;
  readonly purpose: string;
  readonly style?: string;
  readonly imageCount: number;
  readonly quality: string;
  readonly processingTimeMs: number;
}

export async function handleGenerateImage(
  id: string | number,
  args: Record<string, unknown>,
  onSuccess?: (meta: GenerateImageMeta) => void
): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
  // Validate params
  const parsed = GenerateImageParamsSchema.safeParse(args);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return buildErrorResponse(id, INVALID_PARAMS, `Invalid parameters: ${issues}`);
  }

  const params = parsed.data;
  const brand = params.brand ?? getEnv().DEFAULT_BRAND;
  const outputFormat = params.output_format ?? "url";
  const startTime = Date.now();

  try {
    // Fetch brand context from Cortex
    const cortex = createCachedCortexClient(brand);
    const { context } = await cortex.getBrandContext(brand, {
      topic: params.topic,
      persona: params.persona,
      audience: params.audience,
      industry: params.industry,
    });

    // Assemble prompt
    const promptBundle = assemblePrompt(
      {
        ...params,
        count: params.count ?? 1,
        quality: params.quality ?? "hd",
      },
      context
    );

    // Generate images (through concurrency queue with env-configured limits)
    const { provider, internalModel } = resolveModel(params.model);
    const env = getEnv();
    const queue = getGenerateQueue(env.MAX_CONCURRENT_GENERATES, env.GENERATE_QUEUE_TIMEOUT_MS);
    const generatedImages = await queue.enqueue(() =>
      provider.generate(promptBundle, internalModel),
    );

    // Build image results based on output format
    const images = await Promise.all(
      generatedImages.map(async (img, idx) => {
        const base64 = img.data.toString("base64");

        if (outputFormat === "url") {
          const filename = `orbit/${brand}/${params.purpose}/${Date.now()}-${idx}.png`;
          const blob = await uploadImageToBlob(base64, img.mimeType, filename);
          return {
            url: blob.url,
            mimeType: img.mimeType,
            dimensions: img.dimensions,
            prompt: img.prompt,
          };
        }

        return {
          base64,
          mimeType: img.mimeType,
          dimensions: img.dimensions,
          prompt: img.prompt,
        };
      })
    );

    const count = params.count ?? 1;
    const quality = params.quality ?? "hd";

    onSuccess?.({
      brand,
      purpose: params.purpose,
      style: params.style,
      imageCount: count,
      quality,
      processingTimeMs: Date.now() - startTime,
    });

    return buildSuccessResponse(id, {
      images,
      brand,
      output_format: outputFormat,
    });
  } catch (error) {
    if (error instanceof CortexError) {
      return buildErrorResponse(
        id,
        CORTEX_ERROR,
        "Failed to retrieve brand data from Cortex"
      );
    }

    // Network-level fetch failures (Cortex unreachable)
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return buildErrorResponse(
        id,
        CORTEX_ERROR,
        "Failed to reach Cortex service"
      );
    }

    if (error instanceof ProviderError) {
      return buildErrorResponse(
        id,
        PROVIDER_ERROR,
        "Image generation failed"
      );
    }

    // Blob token missing
    if (error instanceof Error && error.message.includes("BLOB_READ_WRITE_TOKEN")) {
      return buildErrorResponse(
        id,
        INVALID_PARAMS,
        error.message
      );
    }

    createLogger({ module: "mcp" }).error("Unexpected error in generate-image", {
      error: error instanceof Error ? error.message : String(error),
    });
    return buildErrorResponse(id, INTERNAL_ERROR, "An internal error occurred");
  }
}

// ─── list-brands ───

export async function handleListBrands(
  id: string | number
): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
  try {
    const cortex = createCachedCortexClient();
    const brands = await cortex.listBrands();
    return buildSuccessResponse(id, {
      brands: brands.map((b: { id: string; active: boolean }) => ({
        id: b.id,
        active: b.active,
      })),
    });
  } catch (error) {
    if (error instanceof CortexError) {
      return buildErrorResponse(id, CORTEX_ERROR, "Failed to fetch brands from Cortex");
    }
    return buildErrorResponse(id, INTERNAL_ERROR, "Failed to list brands");
  }
}

// ─── get-image ───

export async function handleGetImage(
  id: string | number,
  args: Record<string, unknown>,
  clientId?: string
): Promise<JsonRpcSuccessResponse | JsonRpcErrorResponse> {
  const jobId = typeof args.job_id === "string" ? args.job_id : undefined;

  if (!jobId) {
    return buildErrorResponse(id, INVALID_PARAMS, "job_id is required");
  }

  try {
    const job = await getJob(jobId);

    if (!job) {
      return buildErrorResponse(id, INVALID_PARAMS, "Job not found or expired");
    }

    // Ownership check — clients can only see their own jobs
    if (clientId && clientId !== "master" && job.clientId !== clientId) {
      return buildErrorResponse(id, INVALID_PARAMS, "Job not found or expired");
    }

    return buildSuccessResponse(id, {
      job_id: job.id,
      status: job.status,
      request: job.request,
      result: job.result ?? null,
      error: job.error ?? null,
      created_at: job.createdAt,
      completed_at: job.completedAt ?? null,
    });
  } catch {
    return buildErrorResponse(id, INTERNAL_ERROR, "Failed to retrieve job");
  }
}
