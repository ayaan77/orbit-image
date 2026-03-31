"use client";

import { useCallback, useMemo } from "react";
import { getClaudeCodeConfig } from "@/lib/client/snippets";
import { useToast } from "@/components/Toast";
import { useTunnel } from "@/lib/client/useTunnel";
import styles from "./page.module.css";

/* ─── Types ─── */

interface Endpoint {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: string;
  readonly description: string;
}

interface McpTool {
  readonly name: string;
  readonly description: string;
}

/* ─── Data ─── */

const ENDPOINTS: readonly Endpoint[] = [
  { method: "POST", path: "/api/generate", description: "Generate images (sync or async)" },
  { method: "POST", path: "/api/mcp", description: "MCP server (JSON-RPC 2.0)" },
  { method: "GET", path: "/api/brands", description: "List available brands" },
  { method: "GET", path: "/api/health", description: "Health check" },
  { method: "GET", path: "/api/providers/status", description: "Provider availability" },
  { method: "GET", path: "/api/jobs/[id]", description: "Poll async job status" },
];

const MCP_TOOLS: readonly McpTool[] = [
  { name: "generate-image", description: "Generate brand-consistent images with AI" },
  { name: "list-models", description: "List available models (GPT, Flux, Grok)" },
  { name: "list-brands", description: "List brands from Cortex" },
  { name: "list-styles", description: "Available visual styles" },
  { name: "list-purposes", description: "Image purposes with default dimensions" },
  { name: "get-image", description: "Retrieve a generated image by job ID" },
];

/* ─── Icons ─── */

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

/* ─── Helpers ─── */

function getMethodClass(method: string): string {
  switch (method) {
    case "GET":
      return styles.methodGet;
    case "POST":
      return styles.methodPost;
    case "DELETE":
      return styles.methodDelete;
    default:
      return styles.methodGet;
  }
}

/* ─── Page ─── */

export default function ConnectPage() {
  const { showToast } = useToast();
  const tunnelResult = useTunnel();
  const tunnelUrl = tunnelResult?.tunnel.status === "active" ? tunnelResult.tunnel.url : null;
  const isLocal = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const origin = tunnelUrl ?? (typeof window !== "undefined" ? window.location.origin : "https://your-domain.com");

  const mcpConfig = useMemo(
    () => getClaudeCodeConfig(origin, "YOUR_TOKEN"),
    [origin],
  );

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard`, "success");
      } catch {
        showToast("Failed to copy to clipboard", "error");
      }
    },
    [showToast],
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Connect</h1>
      <p className={styles.subtitle}>
        Connect to Orbit Image via MCP or REST API. Generate tokens on the Tokens page.
      </p>

      {/* ─── Tunnel Banner ─── */}
      {tunnelUrl && (
        <div className={styles.tunnelBanner}>
          <span className={styles.tunnelDot} />
          <span>Tunnel Active — configs below use your public URL</span>
          <code className={styles.tunnelUrl}>{tunnelUrl}</code>
        </div>
      )}
      {isLocal && !tunnelUrl && (
        <div className={styles.tunnelHint}>
          Start a tunnel from the main dashboard to share these configs externally.
        </div>
      )}

      {/* ─── Section 1: MCP Connection ─── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>MCP Connection</h2>
        <p className={styles.sectionSubtitle}>
          Add this to your MCP config in Claude Code, Claude Desktop, Cursor, or any MCP-compatible client:
        </p>
        <div className={styles.codeWrapper}>
          <pre className={styles.codeBlock}>{mcpConfig}</pre>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => void copyToClipboard(mcpConfig, "MCP config")}
          >
            <CopyIcon />
            Copy
          </button>
        </div>
        <p className={styles.note}>
          Works from anywhere — no local files, no Node.js required. Generate a token from the Tokens page.
        </p>
      </div>

      {/* ─── Section 2: REST API Reference ─── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>REST API</h2>
        <p className={styles.sectionSubtitle}>
          Direct HTTP access. All endpoints require <code>Authorization: Bearer &lt;token&gt;</code> header.
        </p>
        <div className={styles.endpointList}>
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className={styles.endpointRow}>
              <span className={`${styles.methodBadge} ${getMethodClass(ep.method)}`}>
                {ep.method}
              </span>
              <span className={styles.endpointPath}>{ep.path}</span>
              <span className={styles.endpointDesc}>{ep.description}</span>
              <button
                type="button"
                className={styles.copyUrlBtn}
                onClick={() => void copyToClipboard(`${origin}${ep.path}`, "URL")}
              >
                <CopyIcon />
                Copy URL
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Section 3: MCP Tools ─── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>MCP Tools</h2>
        <div className={styles.toolGrid}>
          {MCP_TOOLS.map((tool) => (
            <div key={tool.name} className={styles.toolCard}>
              <span className={styles.toolName}>{tool.name}</span>
              <span className={styles.toolDesc}>{tool.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
