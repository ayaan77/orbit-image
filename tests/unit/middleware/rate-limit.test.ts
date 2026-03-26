import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitHeaders,
  resetRateLimitState,
} from "@/lib/middleware/rate-limit";

function makeRequest(token: string = "Bearer test-secret"): Request {
  return new Request("http://localhost:3000/api/generate", {
    headers: { authorization: token },
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("returns null when under the limit", async () => {
    const result = await checkRateLimit(makeRequest());
    expect(result).toBeNull();
  });

  it("returns 429 when limit exceeded", async () => {
    const limit = 3;
    const req = makeRequest();

    // Consume all allowed requests
    for (let i = 0; i < limit; i++) {
      expect(await checkRateLimit(req, limit)).toBeNull();
    }

    // Next request should be rate-limited
    const limited = await checkRateLimit(req, limit);
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
  });

  it("includes rate limit headers on 429 response", async () => {
    const limit = 1;
    const req = makeRequest();

    await checkRateLimit(req, limit); // consume the single allowed request
    const limited = await checkRateLimit(req, limit);

    expect(limited).not.toBeNull();
    expect(limited!.headers.get("Retry-After")).toBeTruthy();
    expect(limited!.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(limited!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(limited!.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("returns proper error JSON body on 429", async () => {
    const limit = 1;
    const req = makeRequest();

    await checkRateLimit(req, limit);
    const limited = (await checkRateLimit(req, limit))!;
    const body = await limited.json();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toContain("Rate limit exceeded");
  });

  it("tracks different clients separately", async () => {
    const limit = 1;
    const reqA = makeRequest("Bearer client-a");
    const reqB = makeRequest("Bearer client-b");

    expect(await checkRateLimit(reqA, limit)).toBeNull();
    expect(await checkRateLimit(reqB, limit)).toBeNull();

    // Both should now be limited independently
    expect(await checkRateLimit(reqA, limit)).not.toBeNull();
    expect(await checkRateLimit(reqB, limit)).not.toBeNull();
  });

  it("uses per-client rate limit when provided", async () => {
    const req = makeRequest();

    // Client with limit of 2
    expect(await checkRateLimit(req, 2)).toBeNull();
    expect(await checkRateLimit(req, 2)).toBeNull();
    expect(await checkRateLimit(req, 2)).not.toBeNull();
  });

  it("falls back to global limit when no client limit", async () => {
    const req = makeRequest();
    // Global RATE_LIMIT_PER_MINUTE is set to 60 in test setup
    const result = await checkRateLimit(req);
    expect(result).toBeNull();
  });

  it("uses x-forwarded-for as fallback key when no auth header", async () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(await checkRateLimit(req, 1)).toBeNull();
    expect(await checkRateLimit(req, 1)).not.toBeNull();
  });
});

describe("getRateLimitHeaders", () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  it("returns correct headers with full remaining quota", async () => {
    const req = makeRequest();
    const headers = await getRateLimitHeaders(req, 60);

    expect(headers["X-RateLimit-Limit"]).toBe("60");
    expect(headers["X-RateLimit-Remaining"]).toBe("60");
    expect(headers["X-RateLimit-Reset"]).toBeTruthy();
  });

  it("decrements remaining after requests", async () => {
    const req = makeRequest();
    const limit = 10;

    await checkRateLimit(req, limit); // 1 request consumed
    await checkRateLimit(req, limit); // 2 requests consumed

    const headers = await getRateLimitHeaders(req, limit);
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("8");
  });

  it("shows 0 remaining when fully consumed", async () => {
    const req = makeRequest();
    const limit = 2;

    await checkRateLimit(req, limit);
    await checkRateLimit(req, limit);

    const headers = await getRateLimitHeaders(req, limit);
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});
