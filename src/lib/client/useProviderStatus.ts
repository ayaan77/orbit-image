"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiKey } from "@/lib/client/storage";

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
    const key = getApiKey();
    if (!key) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/providers/status", {
        headers: { Authorization: `Bearer ${key}` },
      });
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
