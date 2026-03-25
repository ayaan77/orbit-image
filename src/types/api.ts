import { z } from "zod";

export const ImagePurpose = z.enum([
  "blog-hero",
  "social-og",
  "ad-creative",
  "case-study",
  "icon",
  "infographic",
]);
export type ImagePurpose = z.infer<typeof ImagePurpose>;

export const ImageStyle = z.enum([
  "photographic",
  "illustration",
  "3d-render",
  "flat-design",
  "abstract",
  "minimalist",
]);
export type ImageStyle = z.infer<typeof ImageStyle>;

export const DimensionsSchema = z.object({
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
});

export const GenerateRequestSchema = z.object({
  topic: z.string().min(1).max(500),
  purpose: ImagePurpose,

  // Brand context
  brand: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Brand must be lowercase alphanumeric with hyphens only")
    .optional(),
  audience: z.string().min(1).max(200).optional(),
  persona: z.string().min(1).max(200).optional(),
  industry: z.string().min(1).max(200).optional(),

  // Image control
  style: ImageStyle.optional(),
  dimensions: DimensionsSchema.optional(),
  count: z.number().int().min(1).max(4).default(1),
  quality: z.enum(["standard", "hd"]).default("hd"),
});
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export interface GeneratedImageResult {
  readonly base64: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface GenerateResponse {
  readonly success: true;
  readonly images: readonly GeneratedImageResult[];
  readonly brand: string;
  readonly metadata: {
    readonly processingTimeMs: number;
    readonly cortexDataCached: boolean;
  };
}

export interface ErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
