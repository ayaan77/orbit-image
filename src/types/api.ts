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

  // Async delivery
  async: z.boolean().optional(),
  webhook_url: z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "https:") return false;
          const host = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

          // Block non-FQDN hostnames (must contain a dot)
          if (!host.includes(".")) return false;

          // Block octal/hex IP notations (e.g. 0177.0.0.1, 0x7f.0.0.1)
          if (/^[\d.]+$/.test(host)) {
            // Pure numeric — validate each octet is plain decimal 0-255
            const octets = host.split(".");
            if (octets.length !== 4) return false;
            for (const o of octets) {
              if (o.startsWith("0") && o.length > 1) return false; // octal
              const n = Number(o);
              if (!Number.isInteger(n) || n < 0 || n > 255) return false;
            }
          }
          if (/0x/i.test(host)) return false; // hex notation

          // Block private/loopback/link-local/reserved ranges
          const blocked =
            /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|::ffff:|fc00:|fd|fe80:)/i;
          return !blocked.test(host);
        } catch {
          return false;
        }
      },
      { message: "Webhook URL must be a public HTTPS endpoint" },
    )
    .optional(),
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

export interface AsyncGenerateResponse {
  readonly success: true;
  readonly async: true;
  readonly jobId: string;
  readonly statusUrl: string;
}

export interface ErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}
