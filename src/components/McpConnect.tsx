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

const CLOUD_SVG = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
  </svg>
);

// ─── Helpers ───

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

// ─── Share Grid Card (one-click copy) ───

interface ShareCardProps {
  readonly icon: string;
  readonly iconClass: string;
  readonly name: string;
  readonly config: string;
}

function ShareCard({ icon, iconClass, name, config }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      showToast(`${name} config copied!`, "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed
    }
  }, [config, name, showToast]);

  return (
    <button className={`${styles.shareCard} ${copied ? styles.shareCardCopied : ""}`} onClick={handleClick}>
      <div className={styles.shareCardTop}>
        <div className={`${styles.shareCardIcon} ${iconClass}`}>{icon}</div>
        <span className={styles.shareCardName}>{name}</span>
      </div>
      <span className={styles.shareCardAction}>
        {copied ? "Copied!" : "Click to copy config"}
      </span>
    </button>
  );
}

// ─── Tunnel Hero Card ───

function TunnelHero({ baseUrl, currentToken }: { readonly baseUrl: string; readonly currentToken: string }) {
  const result = useTunnel();
  const { showToast } = useToast();

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

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("URL copied!", "success");
    } catch {
      // Clipboard write failed
    }
  };

  const isActive = tunnel.status === "active" && tunnel.url;

  // ─── Active State: Integrated Share Grid ───
  if (isActive) {
    return (
      <div className={styles.heroCard}>
        <div className={styles.heroActive}>
          {/* Status bar */}
          <div className={styles.heroStatusBar}>
            <div className={`${styles.heroDot} ${styles.heroDotActive}`} />
            <span className={styles.heroStatusText}>Tunnel Active</span>
            {tunnel.startedAt && (
              <span className={styles.heroElapsed}>
                <ElapsedTime since={tunnel.startedAt} />
              </span>
            )}
            <button className={styles.heroStopBtn} onClick={handleStop}>
              Stop
            </button>
          </div>

          {/* Share Grid */}
          <div className={styles.shareGrid}>
            <ShareCard
              icon="C"
              iconClass={styles.shareIconClaude}
              name="Claude Desktop"
              config={getClaudeDesktopConfig(baseUrl, currentToken)}
            />
            <ShareCard
              icon="▸"
              iconClass={styles.shareIconCursor}
              name="Cursor"
              config={getCursorConfig(baseUrl, currentToken)}
            />
            <ShareCard
              icon=">"
              iconClass={styles.shareIconCode}
              name="Claude Code"
              config={getClaudeCodeConfig(baseUrl, currentToken)}
            />
            <button
              className={styles.shareCard}
              onClick={() => handleCopyUrl(tunnel.url!)}
            >
              <div className={styles.shareCardTop}>
                <div className={`${styles.shareCardIcon} ${styles.shareIconGeneric}`}>{"{"}</div>
                <span className={styles.shareCardName}>Raw URL</span>
              </div>
              <span className={styles.shareCardAction}>Click to copy URL</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Stopped / Starting / Error State: Informational Split ───
  return (
    <div className={styles.heroCard}>
      <div className={styles.heroSplit}>
        {/* Left: Info */}
        <div className={styles.heroLeft}>
          <div className={styles.heroStatus}>
            <div className={`${styles.heroDot} ${
              tunnel.status === "starting" ? styles.heroDotStarting : styles.heroDotStopped
            }`} />
            <span className={styles.heroStatusLabel}>
              {tunnel.status === "starting" ? "Starting..." : "Tunnel Offline"}
            </span>
          </div>
          <h3 className={styles.heroTitle}>Share with your team</h3>
          <p className={styles.heroDesc}>
            Create a public URL so teammates and clients can connect their AI tools to your local Orbit Image server.
          </p>

          {/* Error */}
          {tunnel.status === "error" && (
            <div className={styles.heroError}>{tunnel.error}</div>
          )}

          {/* Not installed */}
          {cloudflaredInstalled === false && (
            <div className={styles.heroInstall}>
              <strong>cloudflared</strong> is required.{" "}
              <code>brew install cloudflare/cloudflare/cloudflared</code>
            </div>
          )}

          {/* Starting */}
          {tunnel.status === "starting" && (
            <div className={styles.heroStartingMsg}>
              Waiting for Cloudflare to assign a URL...
            </div>
          )}

          {/* Start button */}
          {tunnel.status === "stopped" && cloudflaredInstalled !== false && (
            <button className={styles.heroStartBtn} onClick={handleStart}>
              Start Tunnel
            </button>
          )}

          {/* Retry after error */}
          {tunnel.status === "error" && (
            <button className={styles.heroStartBtn} onClick={handleStart}>
              Retry
            </button>
          )}
        </div>

        {/* Right: Visual */}
        <div className={styles.heroRight}>
          <div className={styles.heroCloudIcon}>{CLOUD_SVG}</div>
          <div className={styles.heroClients}>
            <div className={`${styles.heroClientDot} ${styles.shareIconClaude}`}>C</div>
            <div className={`${styles.heroClientDot} ${styles.shareIconCursor}`}>▸</div>
            <div className={`${styles.heroClientDot} ${styles.shareIconCode}`}>{">"}</div>
          </div>
          <span className={styles.heroClientLabel}>Claude · Cursor · CLI</span>
        </div>
      </div>
    </div>
  );
}

// ─── Client Config Card (for non-tunnel / production view) ───

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

  const currentToken = token?.apiKey ?? "YOUR_TOKEN";

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

  return (
    <div className={styles.container}>
      {/* Section 1: Tunnel Hero (localhost only) */}
      {isLocal && <TunnelHero baseUrl={baseUrl} currentToken={currentToken} />}

      {/* Section 2: Token Generator */}
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
          </div>
        )}
      </div>

      {/* Section 3: Client Config Cards (shown when tunnel is NOT active on localhost, or always on production) */}
      {(!isLocal || !tunnelUrl) && (
        <>
          <div className={styles.cardsTitle}>
            {token && isLocal && !tunnelUrl
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
        </>
      )}

      {/* Section 4: Available Tools */}
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
