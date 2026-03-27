import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { getEnv } from "@/lib/config/env";

interface ConfigResponse {
  readonly defaultBrand: string;
  readonly rateLimitPerMinute: number;
  readonly cacheTtlSeconds: number;
  readonly maxConcurrentGenerates: number;
  readonly queueTimeoutMs: number;
  readonly imageCacheTtlSeconds: number;
  readonly redisConfigured: boolean;
  readonly postgresConfigured: boolean;
}

export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  const env = getEnv();

  return NextResponse.json(
    {
      defaultBrand: env.DEFAULT_BRAND,
      rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
      cacheTtlSeconds: env.CACHE_TTL_SECONDS,
      maxConcurrentGenerates: env.MAX_CONCURRENT_GENERATES,
      queueTimeoutMs: env.GENERATE_QUEUE_TIMEOUT_MS,
      imageCacheTtlSeconds: env.IMAGE_CACHE_TTL_SECONDS,
      redisConfigured: Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN),
      postgresConfigured: Boolean(env.POSTGRES_URL),
    },
    { headers },
  );
}
