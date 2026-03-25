import { createCortexClient } from "./client";
import { cacheGet, cacheSet, buildCacheKey, cacheClear } from "./cache";
import { getEnv } from "@/lib/config/env";
import type {
  BrandColours,
  BrandContext,
  BrandInfo,
  BrandVoice,
  CompanyData,
  Persona,
  Audience,
  ProofData,
} from "./types";

const PROOF_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getBrandTtlMs(): number {
  return getEnv().CACHE_TTL_SECONDS * 1000;
}

async function cachedCall<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<{ value: T; cached: boolean }> {
  const existing = cacheGet<T>(key);
  if (existing !== undefined) {
    return { value: existing, cached: true };
  }
  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return { value, cached: false };
}

export function createCachedCortexClient(defaultBrand?: string) {
  const inner = createCortexClient(defaultBrand);
  const brand = defaultBrand ?? getEnv().DEFAULT_BRAND;

  async function fetchColours(b: string) {
    const key = buildCacheKey(b, "get-colours");
    return cachedCall(key, getBrandTtlMs(), () => inner.getColours(b));
  }

  async function fetchBrandVoice(b: string) {
    const key = buildCacheKey(b, "get-brand-voice");
    return cachedCall(key, getBrandTtlMs(), () => inner.getBrandVoice(b));
  }

  async function fetchCompany(b: string) {
    const key = buildCacheKey(b, "get-company");
    return cachedCall(key, getBrandTtlMs(), () => inner.getCompany(b));
  }

  async function fetchProof(
    b: string,
    opts?: { topic?: string; industry?: string; persona?: string; limit?: number }
  ) {
    const proofArgs: Record<string, string | number> = {};
    if (opts?.topic) proofArgs.topic = opts.topic;
    if (opts?.industry) proofArgs.industry = opts.industry;
    if (opts?.persona) proofArgs.persona = opts.persona;
    if (opts?.limit) proofArgs.limit = opts.limit;
    const key = buildCacheKey(b, "get-proof", proofArgs);
    return cachedCall(key, PROOF_TTL_MS, () => inner.getProof(b, opts));
  }

  return {
    async getColours(overrideBrand?: string): Promise<BrandColours> {
      const { value } = await fetchColours(overrideBrand ?? brand);
      return value;
    },

    async getBrandVoice(overrideBrand?: string): Promise<BrandVoice> {
      const { value } = await fetchBrandVoice(overrideBrand ?? brand);
      return value;
    },

    async getCompany(overrideBrand?: string): Promise<CompanyData> {
      const { value } = await fetchCompany(overrideBrand ?? brand);
      return value;
    },

    async getPersonas(overrideBrand?: string, id?: string): Promise<Persona[]> {
      const b = overrideBrand ?? brand;
      const args = id ? { id } : undefined;
      const key = buildCacheKey(b, "get-personas", args);
      const { value } = await cachedCall(key, getBrandTtlMs(), () =>
        inner.getPersonas(b, id)
      );
      return value;
    },

    async getAudiences(overrideBrand?: string, id?: string): Promise<Audience[]> {
      const b = overrideBrand ?? brand;
      const args = id ? { id } : undefined;
      const key = buildCacheKey(b, "get-audiences", args);
      const { value } = await cachedCall(key, getBrandTtlMs(), () =>
        inner.getAudiences(b, id)
      );
      return value;
    },

    async getProof(
      overrideBrand?: string,
      opts?: { topic?: string; industry?: string; persona?: string; limit?: number }
    ): Promise<ProofData> {
      const { value } = await fetchProof(overrideBrand ?? brand, opts);
      return value;
    },

    async listBrands(): Promise<BrandInfo[]> {
      const key = buildCacheKey(brand, "list-brands");
      const { value } = await cachedCall(key, getBrandTtlMs(), () =>
        inner.listBrands()
      );
      return value;
    },

    async getBrandContext(
      overrideBrand?: string,
      opts?: { topic?: string; persona?: string; industry?: string }
    ): Promise<{ context: BrandContext; cached: boolean }> {
      const b = overrideBrand ?? brand;

      const [coloursRes, voiceRes, companyRes, proofRes] = await Promise.all([
        fetchColours(b),
        fetchBrandVoice(b),
        fetchCompany(b),
        opts?.topic
          ? fetchProof(b, {
              topic: opts.topic,
              industry: opts.industry,
              persona: opts.persona,
              limit: 3,
            })
          : Promise.resolve(undefined),
      ]);

      const allCached =
        coloursRes.cached &&
        voiceRes.cached &&
        companyRes.cached &&
        (proofRes?.cached ?? true);

      const context: BrandContext = {
        colours: coloursRes.value,
        voice: voiceRes.value,
        company: companyRes.value,
        proof: proofRes?.value,
      };

      return { context, cached: allCached };
    },

    invalidate(brandId?: string): void {
      cacheClear(brandId ? `${brandId}:` : undefined);
    },
  };
}

export type CachedCortexClient = ReturnType<typeof createCachedCortexClient>;
