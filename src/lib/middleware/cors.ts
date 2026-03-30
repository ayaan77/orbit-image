import { NextResponse } from "next/server";

const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Request-Id";
const MAX_AGE = "86400"; // 24 hours

/**
 * Explicit allowlist of origins. Loaded from CORS_ALLOWED_ORIGINS env var
 * (comma-separated) with sensible defaults.
 *
 * Previously used wildcard *.apexure.com which allowed any subdomain,
 * including forgotten staging sites or subdomain takeover attacks.
 */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  (
    process.env.CORS_ALLOWED_ORIGINS ??
    "https://app.apexure.com,https://studio.apexure.com,https://orbit.apexure.com,https://apexure.com"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/**
 * Determine if an origin is allowed.
 * - Always allows same-origin (no Origin header).
 * - Allows localhost in development.
 * - Checks against explicit allowlist (not wildcard subdomains).
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // same-origin or non-browser

  // Allow localhost in development
  if (
    process.env.NODE_ENV === "development" &&
    (origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1"))
  ) {
    return true;
  }

  return ALLOWED_ORIGINS.has(origin);
}

/**
 * Build CORS headers for a given request origin.
 * Returns empty record if the origin is not allowed.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");

  if (!isOriginAllowed(origin)) {
    return {};
  }

  // Use the actual requesting origin (not wildcard) for credentialed requests
  const allowOrigin = origin ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": MAX_AGE,
    ...(origin ? { Vary: "Origin" } : {}),
  };
}

/**
 * Handle CORS preflight (OPTIONS) request.
 * Returns a 204 No Content response with CORS headers.
 */
export function handlePreflight(request: Request): NextResponse | null {
  if (request.method !== "OPTIONS") return null;

  const headers = corsHeaders(request);

  if (Object.keys(headers).length === 0) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, { status: 204, headers });
}
