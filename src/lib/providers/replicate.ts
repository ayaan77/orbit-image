import Replicate from "replicate";
import type { PromptBundle } from "@/lib/prompt/types";
import { ProviderError } from "./types";
import type { GeneratedImage, ImageProvider } from "./types";
import { getEnv } from "@/lib/config/env";

/** Map pixel dimensions to the nearest standard aspect ratio. */
function resolveAspectRatio(dimensions: {
  width: number;
  height: number;
}): string {
  const ratio = dimensions.width / dimensions.height;

  if (ratio >= 1.7) return "16:9";
  if (ratio >= 1.4) return "3:2";
  if (ratio >= 1.1) return "4:3";
  if (ratio >= 0.9) return "1:1";
  if (ratio >= 0.75) return "3:4";
  if (ratio >= 0.6) return "2:3";
  return "9:16";
}

let clientInstance: Replicate | null = null;

function getClient(): Replicate {
  if (!clientInstance) {
    const { REPLICATE_API_TOKEN } = getEnv();
    if (!REPLICATE_API_TOKEN) {
      throw new ProviderError(
        "REPLICATE_API_TOKEN is required to use the Replicate provider. Set it in your environment."
      );
    }
    clientInstance = new Replicate({ auth: REPLICATE_API_TOKEN });
  }
  return clientInstance;
}

/** Reset singleton (for tests). */
export function resetReplicateClient(): void {
  clientInstance = null;
}

export const replicateProvider: ImageProvider = {
  name: "replicate",

  async generate(bundle: PromptBundle): Promise<readonly GeneratedImage[]> {
    const client = getClient();
    const env = getEnv();
    const model = env.REPLICATE_MODEL as `${string}/${string}`;
    const aspectRatio = resolveAspectRatio(bundle.dimensions);
    const outputQuality = bundle.quality === "hd" ? 95 : 80;

    const promises = Array.from({ length: bundle.count }, () =>
      client.run(model, {
        input: {
          prompt: bundle.positive,
          aspect_ratio: aspectRatio,
          output_format: "png",
          output_quality: outputQuality,
          num_outputs: 1,
        },
      })
    );

    let outputs: unknown[];
    try {
      outputs = await Promise.all(promises);
    } catch (error) {
      throw new ProviderError(
        `Replicate image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    const results: GeneratedImage[] = [];

    for (const output of outputs) {
      // Replicate returns an array of URLs or a single URL string
      const urls = Array.isArray(output) ? output : [output];
      const url = urls[0];

      if (!url || typeof url !== "string") {
        throw new ProviderError("Replicate returned no image URL");
      }

      // Fetch the image and convert to Buffer
      let imageBuffer: Buffer;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new ProviderError(`Failed to fetch image from Replicate: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(
          `Failed to download Replicate image: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      results.push({
        data: imageBuffer,
        mimeType: "image/png",
        prompt: bundle.positive,
        dimensions: bundle.dimensions,
      });
    }

    return results;
  },
};
