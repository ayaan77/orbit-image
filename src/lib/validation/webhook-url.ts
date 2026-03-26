/**
 * Validate that a webhook URL is a safe, public HTTPS endpoint.
 * Blocks SSRF vectors: private IPs, loopback, link-local, non-FQDN, octal/hex notation.
 *
 * Shared between GenerateRequestSchema (per-request webhook_url)
 * and admin keys route (defaultWebhookUrl).
 */
export function isPublicHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

    // Block non-FQDN hostnames (must contain a dot)
    if (!host.includes(".")) return false;

    // Block octal/hex IP notations (e.g. 0177.0.0.1, 0x7f.0.0.1)
    if (/^[\d.]+$/.test(host)) {
      // Pure numeric — validate each octet is plain decimal 0-255
      const octets = host.split(".");
      if (octets.length !== 4) return false;
      for (const o of octets) {
        if (o.startsWith("0") && o.length > 1) return false; // octal
        const n = Number(o);
        if (!Number.isInteger(n) || n < 0 || n > 255) return false;
      }
    }
    if (/0x/i.test(host)) return false; // hex notation

    // Block private/loopback/link-local/reserved ranges
    const blocked =
      /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|::1|::ffff:|fc00:|fd|fe80:)/i;
    return !blocked.test(host);
  } catch {
    return false;
  }
}
