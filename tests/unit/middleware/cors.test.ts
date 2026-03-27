import { describe, it, expect, beforeEach, vi } from "vitest";
import { corsHeaders, handlePreflight } from "@/lib/middleware/cors";

function makeRequest(
  origin?: string,
  method: string = "GET",
): Request {
  const headers: Record<string, string> = {};
  if (origin) headers["origin"] = origin;
  return new Request("http://localhost:3000/api/test", { method, headers });
}

describe("corsHeaders", () => {
  describe("allowed origins", () => {
    it("returns wildcard when no origin header (same-origin)", () => {
      const headers = corsHeaders(makeRequest());
      expect(headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(headers).not.toHaveProperty("Vary");
    });

    it("allows https://apexure.com", () => {
      const headers = corsHeaders(makeRequest("https://apexure.com"));
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://apexure.com");
      expect(headers["Vary"]).toBe("Origin");
    });

    it("allows *.apexure.com subdomains", () => {
      const headers = corsHeaders(makeRequest("https://orbitimage.apexure.com"));
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://orbitimage.apexure.com");
    });

    it("allows deep subdomains of apexure.com", () => {
      const headers = corsHeaders(makeRequest("https://staging.app.apexure.com"));
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://staging.app.apexure.com");
    });

    it("allows cortex.apexure.com", () => {
      const headers = corsHeaders(makeRequest("https://cortex.apexure.com"));
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://cortex.apexure.com");
    });
  });

  describe("blocked origins", () => {
    it("returns empty headers for disallowed origin", () => {
      const headers = corsHeaders(makeRequest("https://evil.com"));
      expect(headers).toEqual({});
    });

    it("blocks http:// (non-HTTPS) apexure.com", () => {
      const headers = corsHeaders(makeRequest("http://apexure.com"));
      expect(headers).toEqual({});
    });

    it("blocks domain spoofing (notapexure.com)", () => {
      const headers = corsHeaders(makeRequest("https://notapexure.com"));
      expect(headers).toEqual({});
    });

    it("blocks invalid origin strings", () => {
      const headers = corsHeaders(makeRequest("not-a-url"));
      expect(headers).toEqual({});
    });
  });

  describe("localhost in development", () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    it("allows localhost in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      const headers = corsHeaders(makeRequest("http://localhost:3000"));
      expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
    });

    it("allows 127.0.0.1 in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      const headers = corsHeaders(makeRequest("http://127.0.0.1:3000"));
      expect(headers["Access-Control-Allow-Origin"]).toBe("http://127.0.0.1:3000");
    });

    it("blocks localhost in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const headers = corsHeaders(makeRequest("http://localhost:3000"));
      expect(headers).toEqual({});
    });
  });

  describe("header values", () => {
    it("includes correct methods", () => {
      const headers = corsHeaders(makeRequest("https://apexure.com"));
      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, DELETE, OPTIONS");
    });

    it("includes correct allowed headers", () => {
      const headers = corsHeaders(makeRequest("https://apexure.com"));
      expect(headers["Access-Control-Allow-Headers"]).toBe(
        "Content-Type, Authorization, X-Request-Id",
      );
    });

    it("sets 24-hour max-age", () => {
      const headers = corsHeaders(makeRequest("https://apexure.com"));
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });
  });
});

describe("handlePreflight", () => {
  it("returns null for non-OPTIONS requests", () => {
    const result = handlePreflight(makeRequest("https://apexure.com", "GET"));
    expect(result).toBeNull();
  });

  it("returns 204 for valid preflight", () => {
    const result = handlePreflight(makeRequest("https://apexure.com", "OPTIONS"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(204);
    expect(result!.headers.get("Access-Control-Allow-Origin")).toBe("https://apexure.com");
  });

  it("returns 403 for disallowed origin preflight", () => {
    const result = handlePreflight(makeRequest("https://evil.com", "OPTIONS"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("returns 204 for same-origin preflight (no origin header)", () => {
    const result = handlePreflight(makeRequest(undefined, "OPTIONS"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(204);
  });
});
