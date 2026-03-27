import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenerateRequest } from "@/types/api";

// In-memory KV store mock
const kvStore = new Map<string, { value: unknown; ex?: number }>();

vi.mock("@/lib/storage/kv", () => ({
  getKv: () => ({
    set: vi.fn(async (key: string, value: unknown, opts?: { ex?: number }) => {
      kvStore.set(key, { value, ex: opts?.ex });
    }),
    get: vi.fn(async <T>(key: string): Promise<T | null> => {
      const entry = kvStore.get(key);
      return (entry?.value as T) ?? null;
    }),
  }),
}));

const { createJob, getJob, updateJob } = await import("@/lib/jobs/store");

const mockRequest: GenerateRequest = {
  topic: "test topic",
  purpose: "blog-hero",
  brand: "apexure",
  count: 1,
  quality: "hd",
  output_format: "base64",
};

describe("createJob", () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it("creates a job with queued status", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
    });

    expect(job.id).toMatch(/^job_[a-f0-9]{24}$/);
    expect(job.status).toBe("queued");
    expect(job.clientId).toBe("client_123");
    expect(job.request).toEqual(mockRequest);
    expect(job.createdAt).toBeTruthy();
    expect(job.completedAt).toBeUndefined();
  });

  it("stores job in KV with 24h TTL", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
    });

    const stored = kvStore.get(`oimg:jobs:${job.id}`);
    expect(stored).toBeDefined();
    expect(stored!.ex).toBe(86_400);
  });

  it("preserves optional webhookUrl", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
      webhookUrl: "https://example.com/hook",
    });

    expect(job.webhookUrl).toBe("https://example.com/hook");
  });

  it("generates unique job IDs", async () => {
    const jobs = await Promise.all(
      Array.from({ length: 5 }, () =>
        createJob({ clientId: "client_123", request: mockRequest }),
      ),
    );
    const ids = new Set(jobs.map((j) => j.id));
    expect(ids.size).toBe(5);
  });
});

describe("getJob", () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it("returns a previously created job", async () => {
    const created = await createJob({
      clientId: "client_123",
      request: mockRequest,
    });

    const fetched = await getJob(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.status).toBe("queued");
  });

  it("returns null for non-existent job", async () => {
    const result = await getJob("job_nonexistent000000000000");
    expect(result).toBeNull();
  });
});

describe("updateJob", () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it("updates job status to processing", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
    });

    const updated = await updateJob(job.id, { status: "processing" });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("processing");
    expect(updated!.completedAt).toBeUndefined();
  });

  it("sets completedAt when status is completed", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
    });

    const result = {
      images: [],
      brand: "apexure",
      processingTimeMs: 1234,
      cortexDataCached: false,
    };

    const updated = await updateJob(job.id, {
      status: "completed",
      result,
    });

    expect(updated!.status).toBe("completed");
    expect(updated!.completedAt).toBeTruthy();
    expect(updated!.result).toEqual(result);
  });

  it("sets completedAt and error when status is failed", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
    });

    const updated = await updateJob(job.id, {
      status: "failed",
      error: "Provider timeout",
    });

    expect(updated!.status).toBe("failed");
    expect(updated!.completedAt).toBeTruthy();
    expect(updated!.error).toBe("Provider timeout");
  });

  it("returns null for non-existent job", async () => {
    const result = await updateJob("job_nonexistent000000000000", {
      status: "completed",
    });
    expect(result).toBeNull();
  });

  it("preserves existing fields on update", async () => {
    const job = await createJob({
      clientId: "client_123",
      request: mockRequest,
      webhookUrl: "https://example.com/hook",
    });

    const updated = await updateJob(job.id, { status: "processing" });
    expect(updated!.clientId).toBe("client_123");
    expect(updated!.webhookUrl).toBe("https://example.com/hook");
    expect(updated!.request).toEqual(mockRequest);
  });
});
