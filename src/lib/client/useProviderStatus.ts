"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";

interface ProviderInfo {
  readonly configured: boolean;
}

export interface ProviderStatus {
  readonly providers: {
    readonly openai: ProviderInfo;
    readonly replicate: ProviderInfo;
    readonly xai: ProviderInfo;
  };
  readonly defaultModel: string;
  readonly availableModels: readonly string[];
}

interface UseProviderStatusResult {
  readonly status: ProviderStatus | null;
  readonly loading: boolean;
  readonly refresh: () => void;
}

export function useProviderStatus(): UseProviderStatusResult {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/providers/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Silently fail — status dots will show as unknown
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, loading, refresh: fetchStatus };
}
