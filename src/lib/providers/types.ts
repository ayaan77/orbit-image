import type { PromptBundle } from "@/lib/prompt/types";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface GeneratedImage {
  readonly data: Buffer;
  readonly mimeType: string;
  readonly prompt: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface ImageProvider {
  readonly name: string;
  generate(bundle: PromptBundle, model?: string): Promise<readonly GeneratedImage[]>;
}
