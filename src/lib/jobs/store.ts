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
 * Update a job's status and optionally set result or error.
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

  const existing = await kv.get<Job>(jobKey(id));
  if (!existing) return null;

  const updated: Job = {
    ...existing,
    status: update.status,
    result: update.result ?? existing.result,
    error: update.error ?? existing.error,
    completedAt:
      update.status === "completed" || update.status === "failed"
        ? new Date().toISOString()
        : existing.completedAt,
  };

  await kv.set(jobKey(id), updated, { ex: JOB_TTL_SECONDS });
  return updated;
}
