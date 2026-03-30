"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/client/api";
import styles from "./Dashboard.module.css";

const AppsPanel = dynamic(() => import("@/components/AppsPanel").then(m => ({ default: m.AppsPanel })), {
  loading: () => <TabSkeleton />,
});
const Playground = dynamic(() => import("@/components/Playground").then(m => ({ default: m.Playground })), {
  loading: () => <TabSkeleton />,
});
const UsagePanel = dynamic(() => import("@/components/UsagePanel").then(m => ({ default: m.UsagePanel })), {
  loading: () => <TabSkeleton />,
});
const QuickStart = dynamic(() => import("@/components/QuickStart").then(m => ({ default: m.QuickStart })), {
  loading: () => <TabSkeleton />,
});
const McpConnect = dynamic(() => import("@/components/McpConnect").then(m => ({ default: m.McpConnect })), {
  loading: () => <TabSkeleton />,
});

function TabSkeleton() {
  return (
    <div className={styles.tabSkeleton}>
      <div className={styles.skeletonPulse}>
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonCards}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
        <div className={styles.skeletonBlock} />
      </div>
    </div>
  );
}

type TabId = "overview" | "connect" | "apps" | "playground" | "usage" | "quickstart";

interface TabDef {
  readonly id: TabId;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const TABS: readonly TabDef[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "connect",
    label: "Connect",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "apps",
    label: "Apps",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "playground",
    label: "Playground",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "usage",
    label: "Usage",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "quickstart",
    label: "Quick Start",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

interface OverviewStats {
  readonly totalImages: number;
  readonly totalCost: number;
  readonly activeClients: number;
  readonly healthStatus: "healthy" | "degraded" | "unhealthy" | "unknown";
  readonly cortexOk: boolean;
  readonly openaiOk: boolean;
}

interface SetupConfig {
  readonly blobConfigured: boolean;
  readonly redisConfigured: boolean;
  readonly webhookConfigured: boolean;
  readonly postgresConfigured: boolean;
  readonly replicateConfigured: boolean;
  readonly xaiConfigured: boolean;
}

const VALID_TABS: ReadonlySet<string> = new Set<TabId>(["overview", "connect", "apps", "playground", "usage", "quickstart"]);

export function Dashboard({ initialTab }: { readonly initialTab?: string } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>(
    initialTab && VALID_TABS.has(initialTab) ? (initialTab as TabId) : "overview"
  );

  return (
    <div className={styles.dashboard}>
      <div className={styles.inner}>
        {/* Sidebar Navigation */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Dashboard</div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.navIcon}>{tab.icon}</span>
              <span className={styles.navLabel}>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <main className={styles.content}>
          {activeTab === "overview" && <OverviewTab onNavigate={setActiveTab} />}
          {activeTab === "connect" && <McpConnect />}
          {activeTab === "apps" && <AppsPanel />}
          {activeTab === "playground" && <Playground />}
          {activeTab === "usage" && <UsagePanel />}
          {activeTab === "quickstart" && <QuickStart />}
        </main>
      </div>
    </div>
  );
}

function OverviewTab({ onNavigate }: { readonly onNavigate: (tab: TabId) => void }) {
  const [stats, setStats] = useState<OverviewStats>({
    totalImages: 0,
    totalCost: 0,
    activeClients: 0,
    healthStatus: "unknown",
    cortexOk: false,
    openaiOk: false,
  });
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, clientsRes, healthRes, configRes] = await Promise.allSettled([
        apiFetch("/api/admin/usage?limit=1"),
        apiFetch("/api/admin/keys"),
        apiFetch("/api/health"),
        apiFetch("/api/admin/config"),
      ]);

      let totalImages = 0;
      let totalCost = 0;
      let activeClients = 0;
      let healthStatus: OverviewStats["healthStatus"] = "unknown";
      let cortexOk = false;
      let openaiOk = false;

      if (usageRes.status === "fulfilled" && usageRes.value.ok) {
        const data = await usageRes.value.json();
        if (data.success) {
          totalImages = data.summary?.totalImages ?? 0;
          totalCost = data.summary?.totalCostUsd ?? 0;
        }
      }

      if (clientsRes.status === "fulfilled" && clientsRes.value.ok) {
        const data = await clientsRes.value.json();
        if (data.success) {
          activeClients = data.clients.filter((c: { active: boolean }) => c.active).length;
        }
      }

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        const data = await healthRes.value.json();
        healthStatus = data.status ?? "unknown";
        cortexOk = data.cortex?.reachable ?? false;
        openaiOk = data.openai?.configured ?? false;
      }

      if (configRes.status === "fulfilled" && configRes.value.ok) {
        const data = await configRes.value.json();
        setConfig({
          blobConfigured: data.blobConfigured ?? false,
          redisConfigured: data.redisConfigured ?? false,
          webhookConfigured: data.webhookConfigured ?? false,
          postgresConfigured: data.postgresConfigured ?? false,
          replicateConfigured: data.replicateConfigured ?? false,
          xaiConfigured: data.xaiConfigured ?? false,
        });
      }

      setStats({ totalImages, totalCost, activeClients, healthStatus, cortexOk, openaiOk });
      setFetchError(null);
    } catch (err) {
      console.warn("[orbit] Dashboard stats fetch failed:", err);
      setFetchError("Could not load dashboard data. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className={styles.overview}>
      <h2 className={styles.pageTitle}>Overview</h2>
      <p className={styles.pageDesc}>
        Monitor your Orbit Image instance at a glance.
      </p>

      {fetchError && (
        <div className={styles.errorBanner} role="alert">
          <span>{fetchError}</span>
          <button className={styles.retryBtn} onClick={fetchStats}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className={styles.overviewLoading}>
          <div className={styles.overviewLoadingCards}>
            <div className={styles.overviewLoadingCard} />
            <div className={styles.overviewLoadingCard} />
            <div className={styles.overviewLoadingCard} />
            <div className={styles.overviewLoadingCard} />
          </div>
          <div className={styles.overviewLoadingSection} />
          <div className={styles.overviewLoadingSection} />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {stats.totalImages.toLocaleString()}
                </span>
                <span className={styles.statTitle}>Images Generated</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  ${stats.totalCost.toFixed(2)}
                </span>
                <span className={styles.statTitle}>Estimated Cost</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {stats.activeClients}
                </span>
                <span className={styles.statTitle}>Connected Apps</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${
                stats.healthStatus === "healthy"
                  ? styles.iconGreen
                  : stats.healthStatus === "degraded"
                    ? styles.iconYellow
                    : stats.healthStatus === "unhealthy"
                      ? styles.iconRed
                      : ""
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {stats.healthStatus === "healthy"
                    ? "Healthy"
                    : stats.healthStatus === "degraded"
                      ? "Degraded"
                      : stats.healthStatus === "unhealthy"
                        ? "Unhealthy"
                        : "Unknown"}
                </span>
                <span className={styles.statTitle}>System Health</span>
              </div>
            </div>
          </div>

          {/* First-run nudge — shown when no apps are connected yet */}
          {stats.activeClients === 0 && (
            <div className={styles.firstRunBanner}>
              <div className={styles.firstRunIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className={styles.firstRunBody}>
                <span className={styles.firstRunTitle}>No apps connected yet</span>
                <span className={styles.firstRunDesc}>
                  Connect your first app to start generating images, or check the setup guide to make sure everything is configured.
                </span>
              </div>
              <div className={styles.firstRunActions}>
                <button className={styles.firstRunPrimary} onClick={() => onNavigate("apps")}>
                  Connect an App
                </button>
                <button className={styles.firstRunSecondary} onClick={() => onNavigate("quickstart")}>
                  Setup Guide
                </button>
              </div>
            </div>
          )}

          {/* Services Status */}
          <div className={styles.servicesSection}>
            <h3 className={styles.sectionTitle}>Services</h3>
            <div className={styles.servicesList}>
              <div className={styles.serviceRow}>
                <span className={`${styles.dot} ${stats.cortexOk ? styles.dotGreen : styles.dotRed}`} />
                <span className={styles.serviceName}>Cortex MCP</span>
                <span className={styles.serviceStatus}>
                  {stats.cortexOk ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className={styles.serviceRow}>
                <span className={`${styles.dot} ${stats.openaiOk ? styles.dotGreen : styles.dotRed}`} />
                <span className={styles.serviceName}>OpenAI</span>
                <span className={styles.serviceStatus}>
                  {stats.openaiOk ? "Configured" : "Not configured"}
                </span>
              </div>
            </div>
          </div>

          {/* Setup Checklist */}
          {config && (
            <SetupChecklist
              openaiOk={stats.openaiOk}
              cortexOk={stats.cortexOk}
              config={config}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Setup Guide ───

interface SetupStep {
  readonly ok: boolean;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
  readonly steps: readonly string[];
}

function SetupStepRow({ step, index }: { readonly step: SetupStep; readonly index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${styles.setupRow} ${step.ok ? styles.setupRowDone : ""}`}>
      <div className={styles.setupRowLeft}>
        <span className={`${styles.setupNum} ${step.ok ? styles.setupNumDone : ""}`}>
          {step.ok ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            index + 1
          )}
        </span>
        <div className={styles.setupRowBody}>
          <div className={styles.setupRowTitle}>
            <span className={styles.setupLabel}>{step.label}</span>
            <span className={`${styles.setupTag} ${step.required ? styles.setupTagRequired : styles.setupTagOptional}`}>
              {step.required ? "Required" : "Optional"}
            </span>
          </div>
          <p className={styles.setupDesc}>{step.description}</p>
          {!step.ok && expanded && (
            <ol className={styles.setupStepList}>
              {step.steps.map((s, i) => (
                <li key={i} className={styles.setupStepItem}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {!step.ok && (
        <button
          className={`${styles.setupExpandBtn} ${expanded ? styles.setupExpandBtnActive : ""}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "How to set up"}
        </button>
      )}
    </div>
  );
}

function SetupChecklist({
  openaiOk,
  cortexOk,
  config,
}: {
  readonly openaiOk: boolean;
  readonly cortexOk: boolean;
  readonly config: SetupConfig;
}) {
  const steps: SetupStep[] = [
    // ─── AI Models (the core) ───
    {
      ok: openaiOk,
      label: "OpenAI — GPT Image 1 & DALL-E 3",
      description: "The default image engine. Generates high-quality, reliable images. You need at least this one to use Orbit.",
      required: true,
      steps: [
        "Go to platform.openai.com and sign in (or create a free account).",
        "Click \"API Keys\" in the left menu, then \"Create new secret key\". Copy it.",
        "Open your Vercel project → Settings → Environment Variables.",
        "Add a new variable: name it OPENAI_API_KEY, paste your key as the value.",
        "Click Save, then go to Deployments and hit Redeploy.",
        "Cost: ~$0.01 per image (standard) / ~$0.04 per image (HD). Pay-as-you-go, no minimum.",
      ],
    },
    {
      ok: config.replicateConfigured,
      label: "Replicate — Flux Pro, Dev & Schnell",
      description: "Adds 3 more models from Black Forest Labs. Flux Schnell is the fastest (under 2 seconds). Flux Pro gives the best style control. Great as a second option alongside OpenAI.",
      required: false,
      steps: [
        "Go to replicate.com and sign up (free account, no credit card needed to start).",
        "Click your avatar → \"API tokens\" → create a new token. Copy it.",
        "In your Vercel project → Settings → Environment Variables.",
        "Add: REPLICATE_API_TOKEN = <paste your token>.",
        "Redeploy. Three new models will appear in the Playground: Flux Pro, Flux Dev, and Flux Schnell.",
        "Cost: Flux Schnell ~$0.003/image (cheapest), Flux Pro ~$0.05/image (highest quality).",
      ],
    },
    {
      ok: config.xaiConfigured,
      label: "xAI — Grok Aurora",
      description: "Adds Grok Aurora from xAI (the company behind Grok). Produces creative, unique visuals with a distinct artistic style. Good for standing out.",
      required: false,
      steps: [
        "Go to console.x.ai and sign in with your X (Twitter) account.",
        "Navigate to \"API Keys\" and create a new key. Copy it.",
        "In your Vercel project → Settings → Environment Variables.",
        "Add: XAI_API_KEY = <paste your key>.",
        "Redeploy. Grok Aurora will appear as a new model option in the Playground.",
        "Cost: varies by usage tier. Check console.x.ai for current pricing.",
      ],
    },
    // ─── Brand context ───
    {
      ok: cortexOk,
      label: "Connect your brand (Cortex MCP)",
      description: "This is what makes Orbit special. Without it, you get generic images. With it, every image automatically uses your brand colors, voice, audience, and proof points.",
      required: false,
      steps: [
        "Ask your Cortex admin for your brand's API endpoint URL (looks like https://yourcompany.apexure.com).",
        "In Vercel env vars, add: CORTEX_BASE_URL = <the URL you were given>.",
        "Redeploy. All generated images will now be tailored to your brand automatically.",
        "Tip: You can also set DEFAULT_BRAND = <your-brand-name> to skip selecting it each time.",
      ],
    },
    // ─── Infrastructure ───
    {
      ok: config.redisConfigured,
      label: "Enable API keys & async mode (Redis)",
      description: "Lets you create separate API keys per app, rate-limit them individually, and enable background image generation so apps don't wait 20+ seconds.",
      required: false,
      steps: [
        "Go to upstash.com and sign up (free tier: 10,000 requests/day).",
        "Click \"Create Database\" → choose Redis → pick a region close to your users.",
        "Copy the REST URL and REST Token from the database page.",
        "In Vercel env vars, add: KV_REST_API_URL = <REST URL> and KV_REST_API_TOKEN = <REST Token>.",
        "Redeploy. You can now create per-app API keys from the Apps tab.",
      ],
    },
    {
      ok: config.blobConfigured,
      label: "Enable image URLs (Vercel Blob)",
      description: "Instead of sending huge base64 data, Orbit uploads images and returns a clean URL. Much faster for apps to display.",
      required: false,
      steps: [
        "In Vercel: go to Storage → Create → Blob Store.",
        "Name it anything (e.g. \"orbit-images\") and create.",
        "Copy the BLOB_READ_WRITE_TOKEN from the store settings.",
        "Add it to your Vercel Environment Variables.",
        "Redeploy. Images will now be served as fast CDN URLs.",
      ],
    },
    {
      ok: config.postgresConfigured,
      label: "Enable usage tracking (Postgres)",
      description: "Track how many images each app generates and what it costs. Useful for budgets, billing, and understanding usage patterns.",
      required: false,
      steps: [
        "In Vercel: go to Storage → Create → Postgres.",
        "Name it anything and create. Tables are set up automatically on first use.",
        "Copy the POSTGRES_URL connection string.",
        "Add to Vercel env vars: POSTGRES_URL = <connection string>.",
        "Redeploy. Usage data will start appearing in the Usage tab.",
      ],
    },
    {
      ok: config.webhookConfigured,
      label: "Enable webhooks (auto-delivery)",
      description: "When an image is ready, Orbit pushes it to your app automatically — no polling needed. Like a notification: \"Your image is done, here it is.\"",
      required: false,
      steps: [
        "Generate a secret: run openssl rand -hex 32 in your terminal, or use any password generator.",
        "In Vercel env vars, add: WEBHOOK_SECRET = <your generated secret>.",
        "Share the same secret with your developer to verify webhook payloads.",
        "Redeploy. Apps can now receive images via webhook callbacks.",
      ],
    },
  ];

  const doneCount = steps.filter((s) => s.ok).length;
  const allOk = doneCount === steps.length;
  const requiredDone = steps.filter((s) => s.required).every((s) => s.ok);

  return (
    <div className={styles.setupSection}>
      <div className={styles.setupHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Getting Started</h3>
          <p className={styles.setupSubtitle}>
            {allOk
              ? "Everything is connected and working."
              : requiredDone
                ? "Core setup is done. The optional services below add more features."
                : "Follow the steps below to get Orbit Image fully set up."}
          </p>
        </div>
        <div className={styles.setupProgress}>
          <span className={styles.setupProgressText}>{doneCount} / {steps.length}</span>
          <div className={styles.setupProgressBar}>
            <div
              className={styles.setupProgressFill}
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {allOk ? (
        <div className={styles.setupAllDone}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>All services are connected. Orbit Image is fully operational.</span>
        </div>
      ) : (
        <div className={styles.setupList}>
          {steps.map((step, i) => (
            <SetupStepRow key={step.label} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
