import { NextResponse } from "next/server";

const ALLOWED_METHODS = "GET, POST, DELETE, OPTIONS";
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Request-Id";
const MAX_AGE = "86400"; // 24 hours

/**
 * Determine if an origin is allowed.
 * - Always allows same-origin (no Origin header).
 * - Allows localhost in development.
 * - Checks against default allowlist.
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

  // Check wildcard subdomain match for apexure.com
  try {
    const url = new URL(origin);
    if (
      url.protocol === "https:" &&
      (url.hostname === "apexure.com" ||
        url.hostname.endsWith(".apexure.com"))
    ) {
      return true;
    }
  } catch {
    // Invalid URL — deny
  }

  return false;
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
