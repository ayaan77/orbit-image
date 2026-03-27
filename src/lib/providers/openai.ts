import OpenAI from "openai";
import type { PromptBundle } from "@/lib/prompt/types";
import { ProviderError } from "./types";
import type { GeneratedImage, ImageProvider } from "./types";
import { getEnv } from "@/lib/config/env";

type OpenAIImageSize =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "1024x1792"
  | "1792x1024"
  | "auto";

// gpt-image-1 supports: 1024x1024, 1536x1024, 1024x1536
// dall-e-3 supports:    1024x1024, 1024x1792, 1792x1024
function resolveSize(
  dimensions: { width: number; height: number },
  model: string,
): OpenAIImageSize {
  const { width, height } = dimensions;
  const ratio = width / height;

  if (model === "dall-e-3") {
    if (width === 1024 && height === 1024) return "1024x1024";
    if (width === 1792 && height === 1024) return "1792x1024";
    if (width === 1024 && height === 1792) return "1024x1792";
    // Fallback to nearest
    if (ratio > 1.2) return "1792x1024";
    if (ratio < 0.8) return "1024x1792";
    return "1024x1024";
  }

  // gpt-image-1
  if (width === 1024 && height === 1024) return "1024x1024";
  if (width === 1536 && height === 1024) return "1536x1024";
  if (width === 1024 && height === 1536) return "1024x1536";
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.8) return "1024x1536";
  return "1024x1024";
}

function parseDimensions(size: OpenAIImageSize): {
  width: number;
  height: number;
} {
  if (size === "auto") return { width: 1024, height: 1024 };
  const [w, h] = size.split("x").map(Number);
  return { width: w, height: h };
}

let clientInstance: OpenAI | null = null;

function getClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = new OpenAI({ apiKey: getEnv().OPENAI_API_KEY });
  }
  return clientInstance;
}

export const openaiProvider: ImageProvider = {
  name: "openai",

  async generate(bundle: PromptBundle, model = "gpt-image-1"): Promise<readonly GeneratedImage[]> {
    const client = getClient();
    const size = resolveSize(bundle.dimensions, model);
    const actualDimensions = parseDimensions(size);

    const results: GeneratedImage[] = [];

    type OpenAIQuality = "auto" | "standard" | "hd" | "high" | "low" | "medium";
    const quality: OpenAIQuality = model === "dall-e-3"
      ? (bundle.quality === "hd" ? "hd" : "standard")
      : (bundle.quality === "hd" ? "high" : "low");

    const promises = Array.from({ length: bundle.count }, () =>
      client.images.generate({
        model,
        prompt: bundle.positive,
        n: 1,
        size,
        quality,
        response_format: "b64_json",
      } as Parameters<OpenAI["images"]["generate"]>[0])
    );

    let responses: Array<{ data?: Array<{ b64_json?: string | null }> }>;
    try {
      responses = (await Promise.all(promises)) as Array<{ data?: Array<{ b64_json?: string | null }> }>;
    } catch (error) {
      throw new ProviderError(
        `OpenAI image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    for (const response of responses) {
      const image = response.data?.[0];
      if (!image?.b64_json) {
        throw new ProviderError("OpenAI returned no image data");
      }

      results.push({
        data: Buffer.from(image.b64_json, "base64"),
        mimeType: "image/png",
        prompt: bundle.positive,
        dimensions: actualDimensions,
      });
    }

    return results;
  },
};
