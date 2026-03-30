import { spawn, execFile, type ChildProcess } from "child_process";
import type { TunnelState } from "./types";

export type { TunnelState } from "./types";

// ─── Constants ───

const STOPPED_STATE: TunnelState = {
  status: "stopped",
  url: null,
  pid: null,
  startedAt: null,
  error: null,
};

const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const START_TIMEOUT_MS = 30_000;

// ─── HMR-safe singleton ───

interface TunnelSingleton {
  state: TunnelState;
  process: ChildProcess | null;
  /** Monotonic counter to detect stale close handlers */
  generation: number;
}

const globalForTunnel = globalThis as unknown as {
  __orbitTunnel?: TunnelSingleton;
};

function getSingleton(): TunnelSingleton {
  if (!globalForTunnel.__orbitTunnel) {
    globalForTunnel.__orbitTunnel = {
      state: { ...STOPPED_STATE },
      process: null,
      generation: 0,
    };
  }
  return globalForTunnel.__orbitTunnel;
}

// ─── Public API ───

export function getTunnelState(): TunnelState {
  return getSingleton().state;
}

export async function isCloudflaredInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("cloudflared", ["--version"], (error) => {
      resolve(error === null);
    });
  });
}

export async function startTunnel(port = 3000): Promise<TunnelState> {
  // Port validation
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      status: "error",
      url: null,
      pid: null,
      startedAt: null,
      error: `Invalid port: ${port}. Must be 1–65535.`,
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      status: "error",
      url: null,
      pid: null,
      startedAt: null,
      error: "Tunnel is not supported in production",
    };
  }

  const singleton = getSingleton();

  // Idempotent: already running or starting
  if (singleton.state.status === "active" || singleton.state.status === "starting") {
    return singleton.state;
  }

  // Set starting state BEFORE any async work to prevent race conditions (#1)
  singleton.state = {
    status: "starting",
    url: null,
    pid: null,
    startedAt: null,
    error: null,
  };

  // Check cloudflared is available
  const installed = await isCloudflaredInstalled();
  if (!installed) {
    const errorState: TunnelState = {
      status: "error",
      url: null,
      pid: null,
      startedAt: null,
      error: "cloudflared is not installed",
    };
    singleton.state = errorState;
    return errorState;
  }

  // Bump generation so stale close handlers from previous processes are ignored (#2)
  singleton.generation += 1;
  const thisGeneration = singleton.generation;

  return new Promise((resolve) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    singleton.process = child;
    singleton.state = { ...singleton.state, pid: child.pid ?? null };

    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      singleton.state = {
        status: "error",
        url: null,
        pid: child.pid ?? null,
        startedAt: null,
        error: "Timed out waiting for tunnel URL (30s)",
      };
      child.kill("SIGTERM");
      // Don't null singleton.process here — let the close handler do it for this generation
      resolve(singleton.state);
    }, START_TIMEOUT_MS);

    const handleData = (data: Buffer) => {
      if (resolved) return;
      const line = data.toString();
      const match = line.match(TUNNEL_URL_REGEX);
      if (match) {
        resolved = true;
        clearTimeout(timeout);
        singleton.state = {
          status: "active",
          url: match[0],
          pid: child.pid ?? null,
          startedAt: new Date().toISOString(),
          error: null,
        };
        resolve(singleton.state);
      }
    };

    // cloudflared logs to stderr
    child.stderr?.on("data", handleData);
    child.stdout?.on("data", handleData);

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      singleton.state = {
        status: "error",
        url: null,
        pid: null,
        startedAt: null,
        error: err.message,
      };
      singleton.process = null;
      resolve(singleton.state);
    });

    child.on("close", (code) => {
      // Guard: ignore close events from a previous generation's process (#2)
      if (thisGeneration !== singleton.generation) return;

      if (singleton.state.status === "active") {
        // Process exited unexpectedly while tunnel was active
        singleton.state = { ...STOPPED_STATE };
      } else if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        singleton.state = {
          status: "error",
          url: null,
          pid: null,
          startedAt: null,
          error: `cloudflared exited with code ${code}`,
        };
        resolve(singleton.state);
      }

      // Only null process if this is still the current generation
      if (singleton.process === child) {
        singleton.process = null;
      }
    });
  });
}

export function stopTunnel(): TunnelState {
  const singleton = getSingleton();

  // Bump generation so the dying process's close handler is ignored (#3)
  singleton.generation += 1;

  if (singleton.process) {
    singleton.process.kill("SIGTERM");
    singleton.process = null;
  }

  singleton.state = { ...STOPPED_STATE };
  return singleton.state;
}
