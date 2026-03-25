import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  API_SECRET_KEY: z.string().min(1, "API_SECRET_KEY is required"),
  CORTEX_BASE_URL: z
    .string()
    .url()
    .refine(
      (url) => {
        const parsed = new URL(url);
        return (
          parsed.protocol === "https:" &&
          parsed.hostname.endsWith(".apexure.com")
        );
      },
      { message: "CORTEX_BASE_URL must be HTTPS on *.apexure.com" }
    )
    .default("https://cortex.apexure.com/api/mcp"),
  DEFAULT_BRAND: z.string().default("apexure"),
  CACHE_TTL_SECONDS: z.coerce.number().positive().default(3600),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

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
