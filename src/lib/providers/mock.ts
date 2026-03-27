import type { PromptBundle } from "@/lib/prompt/types";
import type { GeneratedImage, ImageProvider } from "./types";

/**
 * Mock provider for testing the full pipeline without OpenAI costs.
 * Generates a real 1x1 red PNG pixel so the response is valid image data.
 * Enable via USE_MOCK_PROVIDER=true in .env.
 */

// Minimal valid PNG: 1x1 red pixel
const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

export const mockProvider: ImageProvider = {
  name: "mock",

  async generate(bundle: PromptBundle, _model?: string): Promise<readonly GeneratedImage[]> {
    // Simulate a small delay like a real API
    await new Promise((resolve) => setTimeout(resolve, 200));

    return Array.from({ length: bundle.count }, () => ({
      data: Buffer.from(MOCK_PNG_BASE64, "base64"),
      mimeType: "image/png",
      prompt: bundle.positive,
      dimensions: { ...bundle.dimensions },
    }));
  },
};
