import type { PromptBundle } from "@/lib/prompt/types";
import { ProviderError } from "./types";
import type { GeneratedImage, ImageProvider } from "./types";

const XAI_API_URL = "https://api.x.ai/v1/images/generations";

// xAI Aurora supported sizes
type XAIImageSize = "1024x1024" | "1024x1792" | "1792x1024";

function resolveSize(dimensions: { width: number; height: number }): XAIImageSize {
  const ratio = dimensions.width / dimensions.height;
  if (ratio > 1.2) return "1792x1024";
  if (ratio < 0.8) return "1024x1792";
  return "1024x1024";
}

function parseDimensions(size: XAIImageSize): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number);
  return { width: w, height: h };
}

interface XAIImageResponse {
  data: Array<{ b64_json?: string }>;
}

export const xaiProvider: ImageProvider = {
  name: "xai",

  async generate(bundle: PromptBundle, model = "grok-2-image"): Promise<readonly GeneratedImage[]> {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new ProviderError(
        "XAI_API_KEY is not configured. Add it to your environment to use Grok Aurora."
      );
    }

    const size = resolveSize(bundle.dimensions);
    const actualDimensions = parseDimensions(size);

    const promises = Array.from({ length: bundle.count }, async () => {
      let res: Response;
      try {
        res = await fetch(XAI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            prompt: bundle.positive,
            n: 1,
            size,
            response_format: "b64_json",
          }),
        });
      } catch (error) {
        throw new ProviderError(
          `xAI request failed: ${error instanceof Error ? error.message : "Network error"}`
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new ProviderError(`xAI API error ${res.status}: ${text}`);
      }

      const json = await res.json() as XAIImageResponse;
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        throw new ProviderError("xAI returned no image data");
      }
      return b64;
    });

    let b64List: string[];
    try {
      b64List = await Promise.all(promises);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        `xAI image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return b64List.map((b64) => ({
      data: Buffer.from(b64, "base64"),
      mimeType: "image/png",
      prompt: bundle.positive,
      dimensions: actualDimensions,
    }));
  },
};
