"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/client/api";
import type { TunnelState } from "@/lib/tunnel/types";

export type { TunnelState } from "@/lib/tunnel/types";

const INITIAL_STATE: TunnelState = {
  status: "stopped",
  url: null,
  pid: null,
  startedAt: null,
  error: null,
};

export interface UseTunnelResult {
  readonly tunnel: TunnelState;
  readonly cloudflaredInstalled: boolean | null;
  readonly loading: boolean;
  readonly startTunnel: () => Promise<void>;
  readonly stopTunnel: () => Promise<void>;
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function useTunnel(): UseTunnelResult | null {
  const [tunnel, setTunnel] = useState<TunnelState>(INITIAL_STATE);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLocal = isLocalhost();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/tunnel");
      if (res.ok) {
        const data = await res.json();
        setTunnel(data.tunnel);
        setInstalled(data.cloudflaredInstalled);
      }
    } catch {
      // Silently fail — tunnel feature is optional
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling while starting
  useEffect(() => {
    if (!isLocal) {
      setLoading(false);
      return;
    }

    fetchStatus();
  }, [isLocal, fetchStatus]);

  // Poll while starting — only create/destroy interval on status transitions
  const statusRef = useRef(tunnel.status);
  useEffect(() => {
    const prev = statusRef.current;
    statusRef.current = tunnel.status;

    if (!isLocal) return;

    // Only act on transitions into or out of "starting"
    if (tunnel.status === "starting" && prev !== "starting" && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, 2000);
    } else if (tunnel.status !== "starting" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isLocal, tunnel.status, fetchStatus]);

  const handleStart = useCallback(async () => {
    setTunnel((prev) => ({ ...prev, status: "starting", error: null }));
    try {
      const res = await apiFetch("/api/admin/tunnel", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setTunnel(data.tunnel);
      } else {
        setTunnel({
          status: "error",
          url: null,
          pid: null,
          startedAt: null,
          error: data.error?.message ?? "Failed to start tunnel",
        });
      }
    } catch {
      setTunnel({
        status: "error",
        url: null,
        pid: null,
        startedAt: null,
        error: "Network error — is the dev server running?",
      });
    }
  }, []);

  const handleStop = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/tunnel", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTunnel(data.tunnel);
      }
    } catch {
      // Best effort
    }
  }, []);

  if (!isLocal) return null;

  return {
    tunnel,
    cloudflaredInstalled: installed,
    loading,
    startTunnel: handleStart,
    stopTunnel: handleStop,
  };
}
