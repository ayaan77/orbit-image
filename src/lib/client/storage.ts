const API_KEY_STORAGE_KEY = "orbit-api-key";

export function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export function hasApiKey(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(API_KEY_STORAGE_KEY));
}

// ─── Admin Detection ───

const ADMIN_STORAGE_KEY = "orbit-is-admin";
const ADMIN_KEY_HASH_KEY = "orbit-admin-key-hash";

export function getIsAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_STORAGE_KEY) === "true";
}

export function setIsAdmin(isAdmin: boolean): void {
  if (isAdmin) {
    localStorage.setItem(ADMIN_STORAGE_KEY, "true");
  } else {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    localStorage.removeItem(ADMIN_KEY_HASH_KEY);
  }
}

/** Simple hash to detect key changes without storing the key itself. */
async function keyFingerprint(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Check if the current API key is a master key by probing an admin endpoint.
 * Caches the result in localStorage keyed by a fingerprint of the API key,
 * so it only re-probes when the key actually changes.
 */
export async function detectAdmin(): Promise<boolean> {
  const key = getApiKey();
  if (!key) {
    setIsAdmin(false);
    return false;
  }

  // Skip probe if the key hasn't changed since last check
  const fp = await keyFingerprint(key);
  const cachedFp = localStorage.getItem(ADMIN_KEY_HASH_KEY);
  if (cachedFp === fp) {
    return getIsAdmin();
  }

  try {
    const res = await fetch("/api/admin/keys", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const isAdmin = res.ok;
    setIsAdmin(isAdmin);
    localStorage.setItem(ADMIN_KEY_HASH_KEY, fp);
    return isAdmin;
  } catch {
    setIsAdmin(false);
    return false;
  }
}
