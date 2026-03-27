import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { deliverWebhook, verifySignature } from "@/lib/jobs/webhook";
import type { Job } from "@/lib/jobs/types";

const TEST_SECRET = "whsec_test_secret_key";

function makeCompletedJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job_abc123def456789012345678",
    status: "completed",
    clientId: "client_123",
    request: { topic: "test", purpose: "blog-hero", brand: "apexure", count: 1, quality: "hd", output_format: "base64" },
    result: {
      images: [
        {
          base64: "iVBORw0KGgo=",
          prompt: "test prompt",
          mimeType: "image/png",
          dimensions: { width: 1024, height: 1024 },
        },
      ],
      brand: "apexure",
      processingTimeMs: 5000,
      cortexDataCached: false,
    },
    createdAt: "2026-03-26T10:00:00.000Z",
    completedAt: "2026-03-26T10:00:05.000Z",
    webhookUrl: "https://example.com/webhook",
    ...overrides,
  };
}

function makeFailedJob(overrides: Partial<Job> = {}): Job {
  return {
    ...makeCompletedJob(),
    status: "failed",
    result: undefined,
    error: "Provider timeout",
    ...overrides,
  };
}

describe("verifySignature", () => {
  it("returns true for valid signature", () => {
    const payload = JSON.stringify({ event: "test", data: {} });
    const expected = `sha256=${createHmac("sha256", TEST_SECRET).update(payload).digest("hex")}`;

    expect(verifySignature(payload, expected, TEST_SECRET)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const payload = JSON.stringify({ event: "test", data: {} });
    expect(verifySignature(payload, "sha256=invalid", TEST_SECRET)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const payload = JSON.stringify({ event: "test" });
    const sig = `sha256=${createHmac("sha256", TEST_SECRET).update(payload).digest("hex")}`;

    expect(verifySignature(payload, sig, "wrong_secret")).toBe(false);
  });

  it("returns false for tampered payload", () => {
    const original = JSON.stringify({ event: "test" });
    const sig = `sha256=${createHmac("sha256", TEST_SECRET).update(original).digest("hex")}`;
    const tampered = JSON.stringify({ event: "hacked" });

    expect(verifySignature(tampered, sig, TEST_SECRET)).toBe(false);
  });
});

describe("deliverWebhook", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: ReturnType<typeof vi.spyOn<any, any>>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it("returns false when job has no webhookUrl", async () => {
    const job = makeCompletedJob({ webhookUrl: undefined });
    const result = await deliverWebhook(job, TEST_SECRET);
    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("delivers completed job webhook with correct headers", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const job = makeCompletedJob();
    const result = await deliverWebhook(job, TEST_SECRET);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/webhook");
    expect(opts.method).toBe("POST");

    const headers = opts.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Orbit-Event"]).toBe("generation.completed");
    expect(headers["X-Orbit-Job-Id"]).toBe(job.id);
    expect(headers["X-Orbit-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("sends generation.failed event for failed jobs", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const job = makeFailedJob();
    await deliverWebhook(job, TEST_SECRET);

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["X-Orbit-Event"]).toBe("generation.failed");

    const body = JSON.parse(opts.body as string);
    expect(body.event).toBe("generation.failed");
    expect(body.data.error).toBe("Provider timeout");
  });

  it("includes verifiable HMAC signature in payload", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const job = makeCompletedJob();
    await deliverWebhook(job, TEST_SECRET);

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    const payload = opts.body as string;
    const signature = headers["X-Orbit-Signature"];

    expect(verifySignature(payload, signature, TEST_SECRET)).toBe(true);
  });

  it("returns false for client 4xx errors without retrying", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));

    const result = await deliverWebhook(makeCompletedJob(), TEST_SECRET);
    expect(result).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx server errors", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const promise = deliverWebhook(makeCompletedJob(), TEST_SECRET);
    await vi.advanceTimersByTimeAsync(1_000); // 1st retry delay
    const result = await promise;

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries on network errors", async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const promise = deliverWebhook(makeCompletedJob(), TEST_SECRET);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await promise;

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns false after all retries exhausted", async () => {
    fetchSpy.mockResolvedValue(new Response("Error", { status: 502 }));

    const promise = deliverWebhook(makeCompletedJob(), TEST_SECRET);
    // Advance through all retry delays: 1s + 5s + 15s
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.advanceTimersByTimeAsync(15_000);
    const result = await promise;

    expect(result).toBe(false);
    // Initial attempt + 3 retries = 4 total
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});
