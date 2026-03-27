interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 1000;

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function evictOldest(): void {
  if (store.size < MAX_ENTRIES) return;
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) {
    store.delete(firstKey);
  }
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  evictExpired();
  evictOldest();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function buildCacheKey(
  brand: string,
  tool: string,
  args?: Record<string, unknown>
): string {
  const argsStr = args && Object.keys(args).length > 0
    ? `:${JSON.stringify(args, Object.keys(args).sort())}`
    : "";
  return `${brand}:${tool}${argsStr}`;
}
