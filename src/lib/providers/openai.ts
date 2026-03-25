import OpenAI from "openai";
import type { PromptBundle } from "@/lib/prompt/types";
import { ProviderError } from "./types";
import type { GeneratedImage, ImageProvider } from "./types";
import { getEnv } from "@/lib/config/env";

type OpenAIImageSize =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "auto";

function resolveSize(dimensions: {
  width: number;
  height: number;
}): OpenAIImageSize {
  const { width, height } = dimensions;

  if (width === 1024 && height === 1024) return "1024x1024";
  if (width === 1536 && height === 1024) return "1536x1024";
  if (width === 1024 && height === 1536) return "1024x1536";

  // Fall back to closest supported size
  const ratio = width / height;
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

  async generate(bundle: PromptBundle): Promise<readonly GeneratedImage[]> {
    const client = getClient();
    const size = resolveSize(bundle.dimensions);
    const actualDimensions = parseDimensions(size);

    const results: GeneratedImage[] = [];

    // gpt-image-1 generates one image per call
    const promises = Array.from({ length: bundle.count }, () =>
      client.images.generate({
        model: "gpt-image-1",
        prompt: bundle.positive,
        n: 1,
        size,
        quality: bundle.quality === "hd" ? "high" : "low",
      })
    );

    let responses;
    try {
      responses = await Promise.all(promises);
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
