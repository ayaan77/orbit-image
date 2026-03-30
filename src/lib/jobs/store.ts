import { randomBytes } from "crypto";
import { getKv } from "@/lib/storage/kv";
import type { Job, JobCreateInput, JobResult, JobStatus } from "./types";

const JOB_PREFIX = "oimg:jobs:";
const JOB_TTL_SECONDS = 86_400; // 24 hours

function jobKey(id: string): string {
  return `${JOB_PREFIX}${id}`;
}

function generateJobId(): string {
  return `job_${randomBytes(12).toString("hex")}`;
}

/**
 * Create a new job in Redis. Returns the job with status "queued".
 * Throws if KV is not configured.
 */
export async function createJob(input: JobCreateInput): Promise<Job> {
  const kv = getKv();
  if (!kv) {
    throw new Error("KV storage not configured. Async jobs require Redis.");
  }

  const job: Job = {
    id: generateJobId(),
    status: "queued",
    clientId: input.clientId,
    request: input.request,
    webhookUrl: input.webhookUrl,
    createdAt: new Date().toISOString(),
  };

  await kv.set(jobKey(job.id), job, { ex: JOB_TTL_SECONDS });
  return job;
}

/**
 * Get a job by ID. Returns null if not found or expired.
 */
export async function getJob(id: string): Promise<Job | null> {
  const kv = getKv();
  if (!kv) return null;

  const job = await kv.get<Job>(jobKey(id));
  return job ?? null;
}

/**
 * Atomically update a job's status and optionally set result or error.
 * Uses a Lua script to read-modify-write in a single Redis operation,
 * preventing TOCTOU races if concurrent writers are introduced.
 *
 * Returns the updated job, or null if job not found.
 */
export async function updateJob(
  id: string,
  update: {
    readonly status: JobStatus;
    readonly result?: JobResult;
    readonly error?: string;
  },
): Promise<Job | null> {
  const kv = getKv();
  if (!kv) return null;

  const key = jobKey(id);
  const now = new Date().toISOString();
  const isTerminal = update.status === "completed" || update.status === "failed";

  // Lua script: atomic read-modify-write on a single key
  const script = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return nil end
    local job = cjson.decode(raw)
    job['status'] = ARGV[1]
    if ARGV[2] ~= '' then job['result'] = cjson.decode(ARGV[2]) end
    if ARGV[3] ~= '' then job['error'] = ARGV[3] end
    if ARGV[4] ~= '' then job['completedAt'] = ARGV[4] end
    local encoded = cjson.encode(job)
    redis.call('SET', KEYS[1], encoded, 'EX', tonumber(ARGV[5]))
    return encoded
  `;

  try {
    const rawResult = await kv.eval<
      [string, string, string, string, string],
      string | null
    >(
      script,
      [key],
      [
        update.status,
        update.result ? JSON.stringify(update.result) : "",
        update.error ?? "",
        isTerminal ? now : "",
        String(JOB_TTL_SECONDS),
      ],
    );

    if (!rawResult) return null;
    return JSON.parse(rawResult) as Job;
  } catch {
    // Fallback: non-atomic read-then-write (e.g., if eval is unavailable)
    const existing = await kv.get<Job>(key);
    if (!existing) return null;

    const updated: Job = {
      ...existing,
      status: update.status,
      result: update.result ?? existing.result,
      error: update.error ?? existing.error,
      completedAt: isTerminal ? now : existing.completedAt,
    };

    await kv.set(key, updated, { ex: JOB_TTL_SECONDS });
    return updated;
  }
}
