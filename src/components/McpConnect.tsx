"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import { useTunnel } from "@/lib/client/useTunnel";
import {
  getClaudeDesktopConfig,
  getCursorConfig,
  getClaudeCodeConfig,
  getGenericMcpConfig,
} from "@/lib/client/snippets";
import styles from "./McpConnect.module.css";

interface GeneratedToken {
  readonly apiKey: string;
  readonly mcpUrl: string;
}

const MCP_TOOLS = [
  { name: "generate-image", desc: "Generate brand-consistent images with AI" },
  { name: "list-models", desc: "List available models (GPT, Flux, Grok)" },
  { name: "list-brands", desc: "List brands from Cortex" },
  { name: "list-styles", desc: "Available visual styles" },
  { name: "list-purposes", desc: "Image purposes with default dimensions" },
  { name: "get-image", desc: "Retrieve a generated image by job ID" },
] as const;

const EXAMPLE_PROMPTS = [
  "Generate a blog hero image about AI innovation using the apexure brand",
  "Create 2 social media images for our product launch in minimalist style",
  "Make an ad creative for a SaaS dashboard targeting startup founders",
  "List all available brands and their image generation styles",
] as const;

function CopyButton({ text, label }: { readonly text: string; readonly label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed (permissions or insecure context)
    }
  }, [text]);

  return (
    <button
      className={`${styles.cardCopyBtn} ${copied ? styles.cardCopied : ""}`}
      onClick={handleCopy}
    >
      {copied ? "Copied!" : label ?? "Copy"}
    </button>
  );
}

interface ClientCardProps {
  readonly icon: string;
  readonly iconClass: string;
  readonly name: string;
  readonly config: string;
  readonly hint: React.ReactNode;
}

function ClientCard({ icon, iconClass, name, config, hint }: ClientCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={`${styles.cardIcon} ${iconClass}`}>{icon}</div>
        <div className={styles.cardName}>{name}</div>
      </div>
      <div className={styles.cardCode}>
        <CopyButton text={config} />
        <pre>{config}</pre>
      </div>
      <div className={styles.cardHint}>{hint}</div>
    </div>
  );
}

// ─── Elapsed Time Display ───

function ElapsedTime({ since }: { readonly since: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(since).getTime();
    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);

  return <span>{elapsed}</span>;
}

// ─── Tunnel Section ───

function TunnelSection() {
  const result = useTunnel();
  const { showToast } = useToast();

  // Not on localhost — don't render
  if (!result) return null;

  const { tunnel, cloudflaredInstalled, loading, startTunnel, stopTunnel } = result;

  if (loading) return null;

  const handleStart = async () => {
    showToast("Starting tunnel...", "info");
    await startTunnel();
  };

  const handleStop = async () => {
    await stopTunnel();
    showToast("Tunnel stopped — configs reverted to localhost", "info");
  };

  const handleCopyUrl = async () => {
    if (tunnel.url) {
      try {
        await navigator.clipboard.writeText(tunnel.url);
        showToast("Tunnel URL copied!", "success");
      } catch {
        // Clipboard write failed
      }
    }
  };

  return (
    <div className={styles.tunnelSection}>
      <div className={styles.tunnelHeader}>
        <div className={styles.tunnelIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M12 13v5m0 0l-2-2m2 2l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className={styles.tunnelTitle}>Local Tunnel</div>
          <div className={styles.tunnelSubtitle}>
            Expose localhost to external MCP clients via Cloudflare
          </div>
        </div>
      </div>

      {/* Not installed */}
      {cloudflaredInstalled === false && (
        <div className={styles.tunnelInstall}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <strong>cloudflared</strong> is required.{" "}
            <code>brew install cloudflare/cloudflare/cloudflared</code>
          </div>
        </div>
      )}

      {/* Error state */}
      {tunnel.status === "error" && (
        <div className={styles.tunnelError}>
          {tunnel.error}
        </div>
      )}

      {/* Stopped */}
      {tunnel.status === "stopped" && cloudflaredInstalled !== false && (
        <button
          className={styles.tunnelBtn}
          onClick={handleStart}
        >
          Start Tunnel
        </button>
      )}

      {/* Starting */}
      {tunnel.status === "starting" && (
        <div className={styles.tunnelStarting}>
          <div className={`${styles.tunnelDot} ${styles.tunnelDotStarting}`} />
          <span>Waiting for Cloudflare to assign a URL...</span>
        </div>
      )}

      {/* Active */}
      {tunnel.status === "active" && tunnel.url && (
        <div className={styles.tunnelActive}>
          <div className={styles.tunnelStatusRow}>
            <div className={`${styles.tunnelDot} ${styles.tunnelDotActive}`} />
            <span className={styles.tunnelStatusText}>Tunnel Active</span>
            {tunnel.startedAt && (
              <span className={styles.tunnelMeta}>
                <ElapsedTime since={tunnel.startedAt} />
              </span>
            )}
          </div>
          <div className={styles.tunnelUrl}>
            <code>{tunnel.url}</code>
            <button className={styles.tunnelCopyBtn} onClick={handleCopyUrl}>
              Copy
            </button>
          </div>
          <div className={styles.tunnelNote}>
            Config snippets below now use this tunnel URL
          </div>
          <button className={styles.tunnelBtnStop} onClick={handleStop}>
            Stop Tunnel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export function McpConnect() {
  const { showToast } = useToast();
  const [tokenName, setTokenName] = useState("my-mcp-token");
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<GeneratedToken | null>(null);

  const tunnelResult = useTunnel();
  const tunnelUrl = tunnelResult?.tunnel.status === "active" ? tunnelResult.tunnel.url : null;
  const baseUrl = tunnelUrl ?? (typeof window !== "undefined" ? window.location.origin : "https://your-domain.com");
  const isLocal = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const handleGenerate = useCallback(async () => {
    if (!tokenName.trim()) {
      showToast("Enter a name for your token", "error");
      return;
    }

    setGenerating(true);
    try {
      const res = await apiFetch("/api/admin/tokens", {
        method: "POST",
        body: JSON.stringify({ name: tokenName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create token");
      }

      const data = await res.json();
      const apiKey = data.apiKey ?? "";

      setToken({ apiKey, mcpUrl: `${baseUrl}/api/mcp` });
      showToast("Token created! Copy your config below.", "success", 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create token";
      showToast(message, "error");
    } finally {
      setGenerating(false);
    }
  }, [tokenName, baseUrl, showToast]);

  const handleCopyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      showToast("Prompt copied!", "success");
    } catch {
      // Clipboard write failed
    }
  }, [showToast]);

  const currentToken = token?.apiKey ?? "YOUR_TOKEN";

  return (
    <div className={styles.container}>
      {/* Section 1: Token Generator */}
      <div className={styles.tokenSection}>
        <div className={styles.tokenHeader}>
          <div className={styles.tokenIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.tokenTitle}>Connect &amp; Share via MCP</div>
        </div>
        <div className={styles.tokenSubtitle}>
          Generate a token for yourself or your team, then share the config snippet for their AI client.
        </div>
        <div className={styles.sharingHint}>
          Share this connection with anyone on your team. Each person pastes the config into their own AI client and gets instant access to Orbit Image&apos;s brand-aware generation tools.
        </div>

        {!token ? (
          <div className={styles.tokenForm}>
            <input
              className={styles.tokenInput}
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g. sarah-cursor, design-team-claude"
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              disabled={generating}
            />
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating || !tokenName.trim()}
            >
              {generating ? "Creating..." : "Generate Token"}
            </button>
          </div>
        ) : (
          <div className={styles.tokenResult}>
            <div className={styles.tokenResultLabel}>Your MCP Token</div>
            <div className={styles.tokenValue}>
              <code>{token.apiKey}</code>
              <CopyButton text={token.apiKey} label="Copy" />
            </div>
            <div className={styles.tokenWarning}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Save this token now — it won&apos;t be shown again.
            </div>
            <div className={styles.sharingTip}>
              You can share this token and the config below with teammates who need access.
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Tunnel Controls (localhost only) */}
      {isLocal && <TunnelSection />}

      {/* Section 3: Client Config Cards */}
      <div className={styles.cardsTitle}>
        {token && tunnelUrl
          ? "Share this config (using tunnel URL)"
          : token && isLocal && !tunnelUrl
            ? "Config preview — start a tunnel for external access"
            : token
              ? "Share this config"
              : "Config preview — generate a token to share"}
      </div>

      <div className={styles.cardsGrid}>
        <ClientCard
          icon="C"
          iconClass={styles.cardIconClaude}
          name="Claude Desktop"
          config={getClaudeDesktopConfig(baseUrl, currentToken)}
          hint={<>Paste into <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> — share with any teammate using Claude Desktop</>}
        />
        <ClientCard
          icon="▸"
          iconClass={styles.cardIconCursor}
          name="Cursor"
          config={getCursorConfig(baseUrl, currentToken)}
          hint={<>Paste into <code>Cursor Settings → MCP Servers</code> — works for any Cursor user on your team</>}
        />
        <ClientCard
          icon=">"
          iconClass={styles.cardIconCode}
          name="Claude Code (CLI)"
          config={getClaudeCodeConfig(baseUrl, currentToken)}
          hint={<>Add to your project&apos;s <code>.mcp.json</code> file — commit to repo so your whole team gets it</>}
        />
        <ClientCard
          icon="{"
          iconClass={styles.cardIconGeneric}
          name="Other MCP Client"
          config={getGenericMcpConfig(baseUrl, currentToken)}
          hint="Share the URL and token with anyone using an MCP-compatible client"
        />
      </div>

      {/* Section 3: Available Tools */}
      <div className={styles.toolsSection}>
        <div className={styles.toolsTitle}>Available Tools</div>
        <div className={styles.toolsList}>
          {MCP_TOOLS.map((tool) => (
            <div key={tool.name} className={styles.toolItem}>
              <span className={styles.toolBadge}>{tool.name}</span>
              <span className={styles.toolDesc}>{tool.desc}</span>
            </div>
          ))}
        </div>

        <div className={styles.promptsTitle}>Try these prompts after connecting:</div>
        <ul className={styles.promptsList}>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <li
              key={prompt}
              className={styles.promptItem}
              onClick={() => handleCopyPrompt(prompt)}
              title="Click to copy"
            >
              &ldquo;{prompt}&rdquo;
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
