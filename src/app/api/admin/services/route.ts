import { NextResponse } from "next/server";
import { isMasterKey, unauthorizedResponse } from "@/lib/middleware/admin-auth";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";
import { createCachedCortexClient } from "@/lib/cortex/cached-client";
import { getKv } from "@/lib/storage/kv";
import { getDb } from "@/lib/storage/db";
import { getEnv } from "@/lib/config/env";

interface ServiceStatus {
  readonly connected: boolean;
  readonly latencyMs?: number;
  readonly error?: string;
}

interface ServicesResponse {
  readonly cortex: ServiceStatus;
  readonly openai: ServiceStatus;
  readonly redis: ServiceStatus;
  readonly postgres: ServiceStatus;
}

async function testCortex(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const cortex = createCachedCortexClient();
    const brands = await cortex.listBrands();
    return {
      connected: Array.isArray(brands) && brands.length > 0,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function testOpenai(): ServiceStatus {
  try {
    const configured = Boolean(getEnv().OPENAI_API_KEY);
    return { connected: configured };
  } catch {
    return { connected: false, error: "OPENAI_API_KEY not configured" };
  }
}

async function testRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const kv = getKv();
    if (!kv) {
      return { connected: false, error: "KV env vars not configured" };
    }
    await kv.ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function testPostgres(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const sql = getDb();
    if (!sql) {
      return { connected: false, error: "POSTGRES_URL not configured" };
    }
    await sql`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const headers = requestIdHeaders(getRequestId(request));
  if (!(await isMasterKey(request))) return unauthorizedResponse(headers);

  const [cortex, redis, postgres] = await Promise.all([
    testCortex(),
    testRedis(),
    testPostgres(),
  ]);

  const openai = testOpenai();

  return NextResponse.json(
    { cortex, openai, redis, postgres },
    { headers },
  );
}
