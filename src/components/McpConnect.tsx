"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
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

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
  readonly hint: string;
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
      <div className={styles.cardHint} dangerouslySetInnerHTML={{ __html: hint }} />
    </div>
  );
}

export function McpConnect() {
  const { showToast } = useToast();
  const [tokenName, setTokenName] = useState("my-mcp-token");
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<GeneratedToken | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

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
      const mcpUrl = data.mcpUrl ?? `${baseUrl}/api/mcp?token=${apiKey}`;

      setToken({ apiKey, mcpUrl });
      showToast("Token created! Copy your config below.", "success", 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create token";
      showToast(message, "error");
    } finally {
      setGenerating(false);
    }
  }, [tokenName, baseUrl, showToast]);

  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      showToast("Prompt copied!", "success");
    });
  }, [showToast]);

  const mcpUrl = token?.mcpUrl ?? `${baseUrl}/api/mcp?token=YOUR_TOKEN`;

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
          <div className={styles.tokenTitle}>Connect via MCP</div>
        </div>
        <div className={styles.tokenSubtitle}>
          Generate a token, then copy-paste the config into your AI client.
        </div>

        {!token ? (
          <div className={styles.tokenForm}>
            <input
              className={styles.tokenInput}
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Token name (e.g. my-claude-desktop)"
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

      {/* Section 2: Client Config Cards */}
      <div className={styles.cardsTitle}>
        {token ? "Copy config for your client" : "Config preview (generate a token first)"}
      </div>

      <div className={styles.cardsGrid}>
        <ClientCard
          icon="C"
          iconClass={styles.cardIconClaude}
          name="Claude Desktop"
          config={getClaudeDesktopConfig(mcpUrl)}
          hint='Paste into <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>'
        />
        <ClientCard
          icon="▸"
          iconClass={styles.cardIconCursor}
          name="Cursor"
          config={getCursorConfig(mcpUrl)}
          hint="Paste into <code>Cursor Settings → MCP Servers</code>"
        />
        <ClientCard
          icon=">"
          iconClass={styles.cardIconCode}
          name="Claude Code (CLI)"
          config={getClaudeCodeConfig(mcpUrl)}
          hint="Add to your project's <code>.mcp.json</code> file"
        />
        <ClientCard
          icon="{"
          iconClass={styles.cardIconGeneric}
          name="Other MCP Client"
          config={getGenericMcpConfig(`${baseUrl}/api/mcp`, token?.apiKey ?? "YOUR_TOKEN")}
          hint="Use the URL and token with any MCP-compatible client"
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
