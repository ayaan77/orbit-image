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
