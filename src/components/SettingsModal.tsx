"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getApiKey, setApiKey, clearApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import styles from "./SettingsModal.module.css";

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type TabId = "key" | "services" | "endpoints" | "danger";

interface TabDef {
  readonly id: TabId;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const TABS: readonly TabDef[] = [
  {
    id: "key",
    label: "API Key",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
    label: "Endpoints",
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
    label: "Danger",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

type ConnectionStatus =
  | { readonly state: "idle" }
  | { readonly state: "testing" }
  | {
      readonly state: "done";
      readonly status: "healthy" | "degraded" | "unhealthy";
      readonly cortex: boolean;
      readonly openai: boolean;
    };

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
  const [activeTab, setActiveTab] = useState<TabId>("key");
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus>({
    state: "idle",
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setKeyValue(getApiKey());
      setShowKey(false);
      setConnection({ state: "idle" });
      setActiveTab("key");
      setCopiedIndex(null);
      requestAnimationFrame(() => firstFocusRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  const handleSave = useCallback(() => {
    const trimmed = keyValue.trim();
    if (!trimmed) {
      showToast("API key cannot be empty", "error");
      return;
    }
    setApiKey(trimmed);
    showToast("API key saved", "success");
  }, [keyValue, showToast]);

  const handleTestConnection = useCallback(async () => {
    const key = getApiKey();
    if (!key) {
      showToast("Save an API key first", "error");
      return;
    }
    setConnection({ state: "testing" });
    try {
      const res = await fetch("/api/health", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      setConnection({
        state: "done",
        status: data.status ?? "unhealthy",
        cortex: data.cortex?.reachable ?? false,
        openai: data.openai?.configured ?? false,
      });
    } catch {
      setConnection({
        state: "done",
        status: "unhealthy",
        cortex: false,
        openai: false,
      });
    }
  }, [showToast]);

  const handleClear = useCallback(() => {
    clearApiKey();
    setKeyValue("");
    showToast("Settings cleared", "info");
    onClose();
  }, [onClose, showToast]);

  const handleCopyCurl = useCallback(
    (index: number) => {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const key = getApiKey() || "YOUR_API_KEY";
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
          {activeTab === "key" && (
            <ApiKeyTab
              keyValue={keyValue}
              showKey={showKey}
              firstFocusRef={firstFocusRef}
              onKeyChange={setKeyValue}
              onToggleVisibility={() => setShowKey(!showKey)}
              onSave={handleSave}
            />
          )}
          {activeTab === "services" && (
            <ServicesTab
              connection={connection}
              onTestConnection={handleTestConnection}
            />
          )}
          {activeTab === "endpoints" && (
            <EndpointsTab
              copiedIndex={copiedIndex}
              onCopy={handleCopyCurl}
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

function ApiKeyTab({
  keyValue,
  showKey,
  firstFocusRef,
  onKeyChange,
  onToggleVisibility,
  onSave,
}: {
  readonly keyValue: string;
  readonly showKey: boolean;
  readonly firstFocusRef: React.RefObject<HTMLInputElement | null>;
  readonly onKeyChange: (v: string) => void;
  readonly onToggleVisibility: () => void;
  readonly onSave: () => void;
}) {
  return (
    <div className={styles.section}>
      <label className={styles.label} htmlFor="settings-api-key">
        API Key
      </label>
      <p className={styles.hint}>
        Your API key is stored locally in your browser and never sent to our
        servers.
      </p>
      <div className={styles.inputRow}>
        <input
          ref={firstFocusRef}
          id="settings-api-key"
          type={showKey ? "text" : "password"}
          className={styles.input}
          value={keyValue}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder="Enter your API key..."
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.toggleVisibility}
          onClick={onToggleVisibility}
          aria-label={showKey ? "Hide API key" : "Show API key"}
        >
          {showKey ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <button className={styles.saveBtn} onClick={onSave}>
        Save Key
      </button>
    </div>
  );
}

function ServicesTab({
  connection,
  onTestConnection,
}: {
  readonly connection: ConnectionStatus;
  readonly onTestConnection: () => void;
}) {
  const services = [
    {
      name: "Cortex MCP",
      description: "Brand data provider",
      status:
        connection.state === "done"
          ? connection.cortex
            ? "connected"
            : "disconnected"
          : "unknown",
    },
    {
      name: "OpenAI",
      description: "Image generation",
      status:
        connection.state === "done"
          ? connection.openai
            ? "connected"
            : "disconnected"
          : "unknown",
    },
    {
      name: "Upstash Redis",
      description: "API key storage",
      status: "env-configured",
    },
    {
      name: "Neon Postgres",
      description: "Usage tracking",
      status: "env-configured",
    },
  ] as const;

  return (
    <div className={styles.section}>
      <div className={styles.servicesHeader}>
        <p className={styles.hint}>
          Service connections are configured via environment variables on the
          server. Use &quot;Test Connection&quot; to verify reachability.
        </p>
        <button
          className={styles.testBtn}
          onClick={onTestConnection}
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
                <path
                  d="M22 12h-4l-3 9L9 3l-3 9H2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Test Connection
            </>
          )}
        </button>
      </div>

      <div className={styles.serviceGrid}>
        {services.map((svc) => (
          <div key={svc.name} className={styles.serviceCard}>
            <div className={styles.serviceInfo}>
              <span className={styles.serviceName}>{svc.name}</span>
              <span className={styles.serviceDesc}>{svc.description}</span>
            </div>
            <ServiceBadge status={svc.status} />
          </div>
        ))}
      </div>

      {connection.state === "done" && (
        <div className={styles.overallStatus}>
          <span
            className={`${styles.statusDot} ${
              connection.status === "healthy"
                ? styles.dotGreen
                : connection.status === "degraded"
                  ? styles.dotYellow
                  : styles.dotRed
            }`}
          />
          <span className={styles.statusText}>
            Overall:{" "}
            {connection.status === "healthy"
              ? "All systems operational"
              : connection.status === "degraded"
                ? "Some services degraded"
                : "Services unreachable"}
          </span>
        </div>
      )}
    </div>
  );
}

function ServiceBadge({
  status,
}: {
  readonly status: "connected" | "disconnected" | "unknown" | "env-configured";
}) {
  const classMap = {
    connected: styles.badgeGreen,
    disconnected: styles.badgeRed,
    unknown: styles.badgeMuted,
    "env-configured": styles.badgeBlue,
  } as const;

  const labelMap = {
    connected: "Connected",
    disconnected: "Disconnected",
    unknown: "Not tested",
    "env-configured": "Env configured",
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
}: {
  readonly copiedIndex: number | null;
  readonly onCopy: (index: number) => void;
}) {
  return (
    <div className={styles.section}>
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
            This will remove your API key and all stored preferences from this
            browser. You&apos;ll need to re-enter your API key to continue using
            the app.
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

/* ─── Shared Icons ─── */

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
