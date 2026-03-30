import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  API_SECRET_KEY: z.string().min(1, "API_SECRET_KEY is required"),
  CORTEX_BASE_URL: z
    .string()
    .url()
    .refine(
      (url) => new URL(url).protocol === "https:",
      { message: "CORTEX_BASE_URL must be an HTTPS URL" }
    )
    .optional(),
  DEFAULT_BRAND: z.string().default("apexure"),
  CACHE_TTL_SECONDS: z.coerce.number().positive().default(3600),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().positive().default(60),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  WEBHOOK_SECRET: z.string().min(16).optional(),
  MAX_CONCURRENT_GENERATES: z.coerce.number().int().positive().default(3),
  GENERATE_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  IMAGE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_MODEL: z.string().default("black-forest-labs/flux-1.1-pro"),
  DEFAULT_PROVIDER: z.enum(["openai", "replicate", "mock"]).default("openai"),
  XAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/** Reset cached env (for tests only). */
export function resetEnvCache(): void {
  cachedEnv = null;
}

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${missing}`);
  }
  cachedEnv = result.data;
  return cachedEnv;
}
