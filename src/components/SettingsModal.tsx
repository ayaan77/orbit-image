"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { clearApiKey } from "@/lib/client/storage";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import styles from "./SettingsModal.module.css";

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type TabId = "account" | "services" | "endpoints" | "danger";

interface TabDef {
  readonly id: TabId;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const TABS: readonly TabDef[] = [
  {
    id: "account",
    label: "Account",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "services",
    label: "Services",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M22 12h-4l-3 9L9 3l-3 9H2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "endpoints",
    label: "API Reference",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M16 18l6-6-6-6M8 6l-6 6 6 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "danger",
    label: "Reset",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

interface ServiceResult {
  readonly connected: boolean;
  readonly latencyMs?: number;
  readonly error?: string;
}

type ConnectionStatus =
  | { readonly state: "idle" }
  | { readonly state: "testing" }
  | {
      readonly state: "done";
      readonly cortex: ServiceResult;
      readonly openai: ServiceResult;
      readonly redis: ServiceResult;
      readonly postgres: ServiceResult;
    };

interface ServerConfig {
  readonly defaultBrand: string;
  readonly rateLimitPerMinute: number;
  readonly cacheTtlSeconds: number;
  readonly maxConcurrentGenerates: number;
  readonly queueTimeoutMs: number;
  readonly imageCacheTtlSeconds: number;
  readonly redisConfigured: boolean;
  readonly postgresConfigured: boolean;
  readonly blobConfigured: boolean;
  readonly activeProvider: string;
  readonly replicateConfigured: boolean;
  readonly xaiConfigured: boolean;
  readonly activeModel: string;
}

interface EndpointInfo {
  readonly method: string;
  readonly path: string;
  readonly description: string;
  readonly curl: string;
}

const ENDPOINTS: readonly EndpointInfo[] = [
  {
    method: "POST",
    path: "/api/generate",
    description: "Generate brand-aware images",
    curl: `curl -X POST {BASE_URL}/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {API_KEY}" \\
  -d '{"topic":"A modern dashboard","purpose":"blog-hero","quality":"hd"}'`,
  },
  {
    method: "GET",
    path: "/api/brands",
    description: "List available brands from Cortex",
    curl: `curl {BASE_URL}/api/brands \\
  -H "Authorization: Bearer {API_KEY}"`,
  },
  {
    method: "GET",
    path: "/api/health",
    description: "Health check for all connected services",
    curl: `curl {BASE_URL}/api/health \\
  -H "Authorization: Bearer {API_KEY}"`,
  },
  {
    method: "POST",
    path: "/api/mcp",
    description: "MCP JSON-RPC 2.0 endpoint",
    curl: `curl -X POST {BASE_URL}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {API_KEY}" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
  },
] as const;

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [connection, setConnection] = useState<ConnectionStatus>({
    state: "idle",
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const { showToast } = useToast();
  const { user, logout } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConnection({ state: "idle" });
      setActiveTab("account");
      setCopiedIndex(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      // Focus trap: cycle Tab within the modal
      if (e.key === "Tab" && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const lastTestRef = useRef<number>(0);

  const handleTestConnection = useCallback(async (force = false) => {
    // Cache result for 30s unless forced
    if (!force && connection.state === "done" && Date.now() - lastTestRef.current < 30_000) {
      return;
    }
    setConnection({ state: "testing" });
    try {
      const res = await apiFetch("/api/admin/services");
      if (!res.ok) {
        // Fall back to health endpoint for non-admin users
        const healthRes = await apiFetch("/api/health");
        const data = await healthRes.json();
        const fail: ServiceResult = { connected: false, error: "Not admin" };
        setConnection({
          state: "done",
          cortex: { connected: data.cortex?.reachable ?? false },
          openai: { connected: data.openai?.configured ?? false },
          redis: fail,
          postgres: fail,
        });
      } else {
        const data = await res.json();
        setConnection({
          state: "done",
          cortex: data.cortex ?? { connected: false },
          openai: data.openai ?? { connected: false },
          redis: data.redis ?? { connected: false },
          postgres: data.postgres ?? { connected: false },
        });
      }
      lastTestRef.current = Date.now();
    } catch {
      const fail: ServiceResult = { connected: false, error: "Network error" };
      setConnection({
        state: "done",
        cortex: fail,
        openai: fail,
        redis: fail,
        postgres: fail,
      });
    }
  }, [showToast, connection.state]);

  const handleClear = useCallback(async () => {
    clearApiKey();
    await logout();
    showToast("Logged out and settings cleared", "info");
    onClose();
  }, [onClose, showToast, logout]);

  const handleCopyCurl = useCallback(
    (index: number) => {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const key = "YOUR_API_KEY";
      const curlCmd = ENDPOINTS[index].curl
        .replace(/\{BASE_URL\}/g, baseUrl)
        .replace(/\{API_KEY\}/g, key);
      navigator.clipboard.writeText(curlCmd).then(() => {
        setCopiedIndex(index);
        showToast("Copied to clipboard", "success");
        setTimeout(() => setCopiedIndex(null), 2000);
      });
    },
    [showToast],
  );

  const fetchConfig = useCallback(async () => {
    if (serverConfig) return;
    try {
      const res = await apiFetch("/api/admin/config");
      if (res.ok) {
        setServerConfig(await res.json());
      }
    } catch {
      // Config is best-effort for admin users
    }
  }, [serverConfig]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <nav className={styles.tabBar} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === "account" && (
            <AccountTab user={user} onLogout={async () => { await logout(); onClose(); }} />
          )}
          {activeTab === "services" && (
            <ServicesTab
              connection={connection}
              serverConfig={serverConfig}
              onTestConnection={handleTestConnection}
              onFetchConfig={fetchConfig}
            />
          )}
          {activeTab === "endpoints" && (
            <EndpointsTab
              copiedIndex={copiedIndex}
              onCopy={handleCopyCurl}
              config={serverConfig}
              onFetchConfig={fetchConfig}
            />
          )}
          {activeTab === "danger" && (
            <DangerTab onClear={handleClear} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Tab Components ─── */

function AccountTab({
  user,
  onLogout,
}: {
  readonly user: { readonly username: string; readonly email?: string; readonly role: string } | null;
  readonly onLogout: () => void;
}) {
  return (
    <div className={styles.section}>
      <p className={styles.hint}>
        You are signed in via session cookie. Your session persists across tabs.
      </p>

      {user && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          padding: "var(--space-4)",
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          marginBottom: "var(--space-4)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Username</span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 500 }}>{user.username}</span>
          </div>
          {user.email && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{user.email}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Role</span>
            <span style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              background: user.role === "admin" ? "rgba(139, 92, 246, 0.15)" : "rgba(255,255,255,0.06)",
              color: user.role === "admin" ? "var(--accent)" : "var(--text-secondary)",
              fontWeight: 500,
            }}>{user.role}</span>
          </div>
        </div>
      )}

      <button className={styles.saveBtn} onClick={onLogout} style={{ background: "rgba(248, 113, 113, 0.1)", color: "var(--error)", border: "1px solid rgba(248, 113, 113, 0.2)" }}>
        Sign Out
      </button>
    </div>
  );
}

function ServicesTab({
  connection,
  serverConfig,
  onTestConnection,
  onFetchConfig,
}: {
  readonly connection: ConnectionStatus;
  readonly serverConfig: ServerConfig | null;
  readonly onTestConnection: (force?: boolean) => void;
  readonly onFetchConfig: () => void;
}) {
  // Auto-test and fetch config when tab opens
  useEffect(() => {
    onTestConnection();
    onFetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getServiceStatus(result: ServiceResult | undefined): "connected" | "disconnected" | "unknown" {
    if (!result) return "unknown";
    return result.connected ? "connected" : "disconnected";
  }

  const coreServices = [
    {
      name: "Cortex MCP",
      description: "Brand data provider — colors, voice, personas",
      key: "cortex" as const,
    },
    {
      name: "OpenAI",
      description: "Image generation — GPT Image 1, DALL-E 3",
      key: "openai" as const,
    },
  ];

  const infraServices = [
    {
      name: "Upstash Redis",
      description: "API keys, rate limiting, async jobs",
      key: "redis" as const,
      configured: serverConfig?.redisConfigured,
    },
    {
      name: "Neon Postgres",
      description: "Usage tracking, webhook logs",
      key: "postgres" as const,
      configured: serverConfig?.postgresConfigured,
    },
  ];

  const aiProviders = [
    {
      name: "OpenAI",
      models: "GPT Image 1, DALL-E 3",
      envVar: "OPENAI_API_KEY",
      configured: connection.state === "done" ? connection.openai.connected : null,
      signupUrl: "platform.openai.com/api-keys",
      required: true,
    },
    {
      name: "Replicate",
      models: "Flux Pro, Flux Dev, Flux Schnell",
      envVar: "REPLICATE_API_TOKEN",
      configured: serverConfig?.replicateConfigured ?? false,
      signupUrl: "replicate.com/account/api-tokens",
      required: false,
    },
    {
      name: "xAI",
      models: "Grok Aurora",
      envVar: "XAI_API_KEY",
      configured: serverConfig?.xaiConfigured ?? false,
      signupUrl: "console.x.ai",
      required: false,
    },
  ];

  const results = connection.state === "done" ? connection : null;
  const coreConnected = results
    ? coreServices.every((s) => results[s.key].connected)
    : false;
  const someConnected = results
    ? coreServices.some((s) => results[s.key].connected)
    : false;

  return (
    <div className={styles.section}>
      <div className={styles.servicesHeader}>
        <p className={styles.hint}>
          Live connectivity status for all services and AI providers.
        </p>
        <button
          className={styles.testBtn}
          onClick={() => onTestConnection(true)}
          disabled={connection.state === "testing"}
        >
          {connection.state === "testing" ? (
            <>
              <span className={styles.spinner} />
              Testing...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Retest
            </>
          )}
        </button>
      </div>

      {/* AI Providers */}
      <div className={styles.providerSection}>
        <p className={styles.providerSectionTitle}>AI Image Providers</p>
        <div className={styles.serviceGrid}>
          {aiProviders.map((p) => (
            <div key={p.name} className={styles.serviceCard}>
              <div className={styles.serviceInfo}>
                <span className={styles.serviceName}>
                  {p.name}
                  {p.required && <span className={styles.requiredDot}> *</span>}
                </span>
                <span className={styles.serviceDesc}>{p.models}</span>
                <span className={styles.serviceDesc}>
                  Env: <code>{p.envVar}</code>
                </span>
              </div>
              <div className={styles.serviceBadgeGroup}>
                <ServiceBadge
                  status={
                    connection.state === "testing"
                      ? "unknown"
                      : p.configured
                        ? "connected"
                        : "disconnected"
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.optionalServicesNote}>
          * Required. Others are optional — each unlocks additional models in the Playground.
        </p>
      </div>

      {/* Core Services */}
      <div className={styles.providerSection}>
        <p className={styles.providerSectionTitle}>Core Services</p>
        <div className={styles.serviceGrid}>
          {coreServices.map((svc) => {
            const result = results?.[svc.key];
            const status = connection.state === "testing" ? "unknown" : getServiceStatus(result);
            return (
              <div key={svc.name} className={styles.serviceCard}>
                <div className={styles.serviceInfo}>
                  <span className={styles.serviceName}>{svc.name}</span>
                  <span className={styles.serviceDesc}>{svc.description}</span>
                  {result?.error && !result.connected && (
                    <span className={styles.serviceError}>{result.error}</span>
                  )}
                </div>
                <div className={styles.serviceBadgeGroup}>
                  <ServiceBadge status={status} />
                  {result?.latencyMs !== undefined && result.connected && (
                    <span className={styles.latency}>{result.latencyMs}ms</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Infrastructure */}
      {serverConfig && (
        <div className={styles.providerSection}>
          <p className={styles.providerSectionTitle}>Infrastructure</p>
          <div className={styles.serviceGrid}>
            {infraServices.map((svc) => {
              const result = results?.[svc.key];
              const status = connection.state === "testing"
                ? "unknown"
                : svc.configured
                  ? "connected"
                  : "disconnected";
              return (
                <div key={svc.name} className={styles.serviceCard}>
                  <div className={styles.serviceInfo}>
                    <span className={styles.serviceName}>{svc.name}</span>
                    <span className={styles.serviceDesc}>{svc.description}</span>
                    {result?.error && !result.connected && (
                      <span className={styles.serviceError}>{result.error}</span>
                    )}
                  </div>
                  <div className={styles.serviceBadgeGroup}>
                    <ServiceBadge status={status} />
                    {result?.latencyMs !== undefined && result.connected && (
                      <span className={styles.latency}>{result.latencyMs}ms</span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Blob storage */}
            <div className={styles.serviceCard}>
              <div className={styles.serviceInfo}>
                <span className={styles.serviceName}>Vercel Blob</span>
                <span className={styles.serviceDesc}>Image URL storage & CDN</span>
              </div>
              <div className={styles.serviceBadgeGroup}>
                <ServiceBadge status={serverConfig.blobConfigured ? "connected" : "disconnected"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overall */}
      {connection.state === "done" && (
        <div className={styles.overallStatus}>
          <span
            className={`${styles.statusDot} ${
              coreConnected
                ? styles.dotGreen
                : someConnected
                  ? styles.dotYellow
                  : styles.dotRed
            }`}
          />
          <span className={styles.statusText}>
            Overall:{" "}
            {coreConnected
              ? "All core services operational"
              : someConnected
                ? "Some services degraded"
                : "Services unreachable"}
          </span>
        </div>
      )}

      {/* Active model */}
      {serverConfig && (
        <div className={styles.providerSection}>
          <p className={styles.providerSectionTitle}>Active Default</p>
          <div className={styles.providerCard}>
            <div className={styles.providerRow}>
              <span className={styles.providerLabel}>Default model</span>
              <span className={styles.providerModel}>{serverConfig.activeModel}</span>
            </div>
            <div className={styles.providerRow}>
              <span className={styles.providerLabel}>Default provider</span>
              <span className={styles.providerBadge}>{serverConfig.activeProvider}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceBadge({
  status,
}: {
  readonly status: "connected" | "disconnected" | "unknown";
}) {
  const classMap = {
    connected: styles.badgeGreen,
    disconnected: styles.badgeRed,
    unknown: styles.badgeMuted,
  } as const;

  const labelMap = {
    connected: "Connected",
    disconnected: "Disconnected",
    unknown: "Testing...",
  } as const;

  return (
    <span className={`${styles.badge} ${classMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

function EndpointsTab({
  copiedIndex,
  onCopy,
  config,
  onFetchConfig,
}: {
  readonly copiedIndex: number | null;
  readonly onCopy: (index: number) => void;
  readonly config: ServerConfig | null;
  readonly onFetchConfig: () => void;
}) {
  // Auto-fetch config when tab opens
  useEffect(() => {
    onFetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.section}>
      {/* Server Configuration */}
      {config && (
        <div className={styles.configSection}>
          <h4 className={styles.configTitle}>Server Configuration</h4>
          <div className={styles.configGrid}>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Default Brand</span>
              <span className={styles.configValue}>{config.defaultBrand}</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Rate Limit</span>
              <span className={styles.configValue}>{config.rateLimitPerMinute} req/min</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Cache TTL</span>
              <span className={styles.configValue}>{config.cacheTtlSeconds}s</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Max Concurrent</span>
              <span className={styles.configValue}>{config.maxConcurrentGenerates}</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Queue Timeout</span>
              <span className={styles.configValue}>{(config.queueTimeoutMs / 1000).toFixed(0)}s</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Image Cache TTL</span>
              <span className={styles.configValue}>{(config.imageCacheTtlSeconds / 3600).toFixed(0)}h</span>
            </div>
          </div>
        </div>
      )}

      {/* API Endpoints */}
      <p className={styles.hint}>
        API endpoints for integrating with Orbit Image. Click &quot;Copy&quot; to get a
        ready-to-use curl command with your API key.
      </p>
      <div className={styles.endpointList}>
        {ENDPOINTS.map((ep, i) => (
          <div key={ep.path} className={styles.endpointCard}>
            <div className={styles.endpointHeader}>
              <span
                className={`${styles.methodBadge} ${
                  ep.method === "POST" ? styles.methodPost : styles.methodGet
                }`}
              >
                {ep.method}
              </span>
              <code className={styles.endpointPath}>{ep.path}</code>
              <button
                className={styles.copyBtn}
                onClick={() => onCopy(i)}
              >
                {copiedIndex === i ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className={styles.endpointDesc}>{ep.description}</p>
          </div>
        ))}
      </div>

      <div className={styles.mcpInfo}>
        <div className={styles.mcpHeader}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>MCP Integration</span>
        </div>
        <p className={styles.mcpText}>
          The <code>/api/mcp</code> endpoint supports JSON-RPC 2.0 for Model
          Context Protocol clients. Available tools: <code>generate-image</code>,{" "}
          <code>list-brands</code>, <code>health-check</code>.
        </p>
      </div>
    </div>
  );
}

function DangerTab({ onClear }: { readonly onClear: () => void }) {
  return (
    <div className={styles.section}>
      <div className={styles.dangerCard}>
        <div className={styles.dangerInfo}>
          <h3 className={styles.dangerTitle}>Clear All Settings</h3>
          <p className={styles.dangerDesc}>
            This will sign you out and clear all stored preferences from this
            browser. You&apos;ll need to sign in again to continue.
          </p>
        </div>
        <button className={styles.clearBtn} onClick={onClear}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Clear All Settings
        </button>
      </div>
    </div>
  );
}

