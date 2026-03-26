import { randomUUID } from "crypto";

const REQUEST_ID_HEADER = "X-Request-Id";
const SAFE_REQUEST_ID = /^[a-zA-Z0-9_\-.]+$/;

/**
 * Generate a unique request ID prefixed with "req_".
 * If the incoming request already has a safe X-Request-Id header, reuse it.
 */
export function getRequestId(request: Request): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (
    existing &&
    existing.length > 0 &&
    existing.length <= 128 &&
    SAFE_REQUEST_ID.test(existing)
  ) {
    return existing;
  }
  return `req_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Build the X-Request-Id header record to spread into response headers.
 */
export function requestIdHeaders(requestId: string): Record<string, string> {
  return { [REQUEST_ID_HEADER]: requestId };
}
