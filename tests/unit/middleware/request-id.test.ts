import { describe, it, expect } from "vitest";
import { getRequestId, requestIdHeaders } from "@/lib/middleware/request-id";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/test", { headers });
}

describe("getRequestId", () => {
  it("generates a req_ prefixed ID when no header present", () => {
    const id = getRequestId(makeRequest());
    expect(id).toMatch(/^req_[a-f0-9]{32}$/);
  });

  it("generates unique IDs per call", () => {
    const ids = new Set(
      Array.from({ length: 10 }, () => getRequestId(makeRequest())),
    );
    expect(ids.size).toBe(10);
  });

  it("reuses existing X-Request-Id header", () => {
    const request = makeRequest({ "X-Request-Id": "custom-trace-123" });
    expect(getRequestId(request)).toBe("custom-trace-123");
  });

  it("ignores empty X-Request-Id header", () => {
    const request = makeRequest({ "X-Request-Id": "" });
    const id = getRequestId(request);
    expect(id).toMatch(/^req_/);
  });

  it("ignores X-Request-Id header exceeding 128 chars", () => {
    const longId = "x".repeat(129);
    const request = makeRequest({ "X-Request-Id": longId });
    const id = getRequestId(request);
    expect(id).toMatch(/^req_/);
    expect(id).not.toBe(longId);
  });

  it("accepts X-Request-Id header at exactly 128 chars", () => {
    const maxId = "a".repeat(128);
    const request = makeRequest({ "X-Request-Id": maxId });
    expect(getRequestId(request)).toBe(maxId);
  });

  it("rejects X-Request-Id with special characters", () => {
    // Newlines are blocked by the Request constructor itself,
    // but spaces and other non-alphanumeric chars are rejected by our regex
    const request = makeRequest({ "X-Request-Id": "id with spaces" });
    expect(getRequestId(request)).toMatch(/^req_/);
  });

  it("rejects X-Request-Id with colons", () => {
    const request = makeRequest({ "X-Request-Id": "id:with:colons" });
    expect(getRequestId(request)).toMatch(/^req_/);
  });

  it("accepts X-Request-Id with dots and hyphens", () => {
    const valid = "trace-123.span-456_req";
    const request = makeRequest({ "X-Request-Id": valid });
    expect(getRequestId(request)).toBe(valid);
  });
});

describe("requestIdHeaders", () => {
  it("returns a record with X-Request-Id key", () => {
    const headers = requestIdHeaders("req_abc123");
    expect(headers).toEqual({ "X-Request-Id": "req_abc123" });
  });
});
