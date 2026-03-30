"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/client/api";
import styles from "./page.module.css";

interface StatCard {
  readonly label: string;
  readonly value: string;
  readonly status: "ok" | "error" | "loading";
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<readonly StatCard[]>([
    { label: "Total Users", value: "--", status: "loading" },
    { label: "MCP Tokens", value: "--", status: "loading" },
    { label: "System Status", value: "--", status: "loading" },
  ]);

  useEffect(() => {
    async function loadStats() {
      const results = await Promise.allSettled([
        apiFetch("/api/admin/users?limit=1").then((r) => r.json()),
        apiFetch("/api/admin/tokens?limit=1").then((r) => r.json()),
        apiFetch("/api/health").then((r) => r.json()),
      ]);

      const updated: StatCard[] = [];

      // Users
      if (results[0].status === "fulfilled") {
        const data = results[0].value;
        const total = data.meta?.total ?? data.total ?? "?";
        updated.push({ label: "Total Users", value: String(total), status: "ok" });
      } else {
        updated.push({ label: "Total Users", value: "Error", status: "error" });
      }

      // Tokens
      if (results[1].status === "fulfilled") {
        const data = results[1].value;
        const total = data.meta?.total ?? data.total ?? "?";
        updated.push({ label: "MCP Tokens", value: String(total), status: "ok" });
      } else {
        updated.push({ label: "MCP Tokens", value: "Error", status: "error" });
      }

      // Health
      if (results[2].status === "fulfilled") {
        const data = results[2].value;
        const healthy = data.status === "ok" || data.healthy === true;
        updated.push({
          label: "System Status",
          value: healthy ? "Healthy" : "Degraded",
          status: healthy ? "ok" : "error",
        });
      } else {
        updated.push({ label: "System Status", value: "Unreachable", status: "error" });
      }

      setStats(updated);
    }

    loadStats();
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Overview</h1>
      <div className={styles.grid}>
        {stats.map((card) => (
          <div key={card.label} className={styles.card}>
            <span
              className={`${styles.value} ${card.status === "error" ? styles.valueError : ""} ${card.status === "loading" ? styles.valueLoading : ""}`}
            >
              {card.value}
            </span>
            <span className={styles.label}>{card.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
