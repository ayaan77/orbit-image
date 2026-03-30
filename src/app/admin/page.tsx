"use client";

import { useState, useEffect, type ReactElement } from "react";
import { apiFetch } from "@/lib/client/api";
import styles from "./page.module.css";

interface StatCardData {
  readonly label: string;
  readonly value: string;
  readonly subtitle: string;
  readonly status: "ok" | "error" | "loading";
  readonly theme: "purple" | "blue" | "green" | "amber";
}

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

const CARD_ICONS: Record<string, () => ReactElement> = {
  purple: PeopleIcon,
  blue: KeyIcon,
  green: PulseIcon,
  amber: ImageIcon,
};

const INITIAL_CARDS: readonly StatCardData[] = [
  { label: "Total Users", value: "--", subtitle: "", status: "loading", theme: "purple" },
  { label: "MCP Tokens", value: "--", subtitle: "", status: "loading", theme: "blue" },
  { label: "System Health", value: "--", subtitle: "", status: "loading", theme: "green" },
  { label: "Images Generated", value: "--", subtitle: "", status: "loading", theme: "amber" },
];

export default function AdminOverviewPage() {
  const [cards, setCards] = useState<readonly StatCardData[]>(INITIAL_CARDS);

  useEffect(() => {
    async function loadStats() {
      const results = await Promise.allSettled([
        apiFetch("/api/admin/users?limit=1").then((r) => r.json()),
        apiFetch("/api/admin/tokens?limit=1").then((r) => r.json()),
        apiFetch("/api/health").then((r) => r.json()),
        apiFetch("/api/admin/usage?limit=1").then((r) => r.json()),
      ]);

      const updated: StatCardData[] = [];

      // Users
      if (results[0].status === "fulfilled") {
        const data = results[0].value;
        const total = data.meta?.total ?? data.total ?? "?";
        const admins = data.meta?.admins ?? 0;
        const users = typeof total === "number" ? total - admins : 0;
        updated.push({
          label: "Total Users",
          value: String(total),
          subtitle: `${admins} admin${admins !== 1 ? "s" : ""}, ${users} user${users !== 1 ? "s" : ""}`,
          status: "ok",
          theme: "purple",
        });
      } else {
        updated.push({ label: "Total Users", value: "Error", subtitle: "Failed to load", status: "error", theme: "purple" });
      }

      // Tokens
      if (results[1].status === "fulfilled") {
        const data = results[1].value;
        const total = data.meta?.total ?? data.total ?? "?";
        const active = data.meta?.active ?? total;
        const revoked = data.meta?.revoked ?? 0;
        updated.push({
          label: "MCP Tokens",
          value: String(total),
          subtitle: `${active} active, ${revoked} revoked`,
          status: "ok",
          theme: "blue",
        });
      } else {
        updated.push({ label: "MCP Tokens", value: "Error", subtitle: "Failed to load", status: "error", theme: "blue" });
      }

      // Health
      if (results[2].status === "fulfilled") {
        const data = results[2].value;
        const healthy = data.status === "ok" || data.healthy === true;
        updated.push({
          label: "System Health",
          value: healthy ? "Healthy" : "Degraded",
          subtitle: healthy ? "All services connected" : (data.message ?? "Service issues detected"),
          status: healthy ? "ok" : "error",
          theme: "green",
        });
      } else {
        updated.push({ label: "System Health", value: "Unreachable", subtitle: "Could not reach health endpoint", status: "error", theme: "green" });
      }

      // Usage / Images Generated
      if (results[3].status === "fulfilled") {
        const data = results[3].value;
        const totalImages = data.summary?.totalImages ?? data.data?.summary?.totalImages ?? 0;
        const totalCost = data.summary?.totalCostUsd ?? data.data?.summary?.totalCostUsd ?? 0;
        updated.push({
          label: "Images Generated",
          value: String(totalImages),
          subtitle: `$${Number(totalCost).toFixed(2)} estimated cost`,
          status: "ok",
          theme: "amber",
        });
      } else {
        updated.push({ label: "Images Generated", value: "Error", subtitle: "Failed to load", status: "error", theme: "amber" });
      }

      setCards(updated);
    }

    loadStats();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Overview</h1>
      <p className={styles.subtitle}>Monitor your Orbit Image instance at a glance.</p>
      <div className={styles.grid}>
        {cards.map((card) => {
          const IconComponent = CARD_ICONS[card.theme];
          return (
            <div key={card.label} className={`${styles.card} ${styles[card.theme]}`}>
              <div className={styles.cardGlow} />
              <div className={styles.cardHeader}>
                <div className={`${styles.iconBox} ${styles[`icon_${card.theme}`]}`}>
                  <IconComponent />
                </div>
                <span className={styles.label}>{card.label}</span>
              </div>
              <div className={styles.cardBody}>
                <span
                  className={`${styles.value} ${card.status === "error" ? styles.valueError : ""} ${card.status === "loading" ? styles.valueLoading : ""}`}
                >
                  {card.theme === "green" && card.status === "ok" && (
                    <span className={styles.healthDot} />
                  )}
                  {card.theme === "green" && card.status === "error" && (
                    <span className={styles.healthDotRed} />
                  )}
                  {card.value}
                </span>
                {card.subtitle && (
                  <span className={styles.cardSubtitle}>{card.subtitle}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
