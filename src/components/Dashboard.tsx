"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiKey } from "@/lib/client/storage";
import { AppsPanel } from "@/components/AppsPanel";
import { Playground } from "@/components/Playground";
import { UsagePanel } from "@/components/UsagePanel";
import { QuickStart } from "@/components/QuickStart";
import styles from "./Dashboard.module.css";

type TabId = "overview" | "apps" | "playground" | "usage" | "quickstart";

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

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "apps" && <AppsPanel />}
          {activeTab === "playground" && <Playground />}
          {activeTab === "usage" && <UsagePanel />}
          {activeTab === "quickstart" && <QuickStart />}
        </main>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats>({
    totalImages: 0,
    totalCost: 0,
    activeClients: 0,
    healthStatus: "unknown",
    cortexOk: false,
    openaiOk: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const key = getApiKey();
    if (!key) return;
    const authHeaders = { Authorization: `Bearer ${key}` };

    setLoading(true);
    try {
      const [usageRes, clientsRes, healthRes] = await Promise.allSettled([
        fetch("/api/admin/usage?limit=1", { headers: authHeaders }),
        fetch("/api/admin/keys", { headers: authHeaders }),
        fetch("/api/health", { headers: authHeaders }),
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

      setStats({ totalImages, totalCost, activeClients, healthStatus, cortexOk, openaiOk });
    } catch {
      // leave defaults
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

      {loading ? (
        <div className={styles.loadingText}>Loading stats...</div>
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
        </>
      )}
    </div>
  );
}
