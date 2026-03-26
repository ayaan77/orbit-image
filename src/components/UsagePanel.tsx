"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import styles from "./UsagePanel.module.css";

interface UsageRow {
  readonly id: number;
  readonly client_id: string;
  readonly client_name: string;
  readonly brand: string;
  readonly purpose: string;
  readonly style: string | null;
  readonly image_count: number;
  readonly quality: string;
  readonly estimated_cost_usd: number;
  readonly processing_time_ms: number;
  readonly cached: boolean;
  readonly endpoint: string;
  readonly created_at: string;
}

interface UsageData {
  readonly usage: readonly UsageRow[];
  readonly pagination: { readonly total: number; readonly limit: number; readonly offset: number };
  readonly summary: { readonly totalCostUsd: number; readonly totalImages: number };
}

export function UsagePanel() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [page, setPage] = useState(0);
  const { showToast } = useToast();

  const limit = 25;

  const fetchUsage = useCallback(async () => {
    const key = getApiKey();
    if (!key) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filterClient) params.set("clientId", filterClient);
    if (filterBrand) params.set("brand", filterBrand);
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));

    try {
      const res = await fetch(`/api/admin/usage?${params.toString()}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error?.message ?? "Failed to load usage data");
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [filterClient, filterBrand, page]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleFilter = useCallback(() => {
    setPage(0);
    fetchUsage();
  }, [fetchUsage]);

  const totalPages = data ? Math.ceil(data.pagination.total / limit) : 0;

  return (
    <div className={styles.container}>
      {/* Summary Cards */}
      {data && (
        <div className={styles.summaryRow}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{data.summary.totalImages.toLocaleString()}</span>
            <span className={styles.statLabel}>Total Images</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>${data.summary.totalCostUsd.toFixed(2)}</span>
            <span className={styles.statLabel}>Total Cost</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{data.pagination.total.toLocaleString()}</span>
            <span className={styles.statLabel}>Total Requests</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <input
          className={styles.filterInput}
          placeholder="Filter by client ID..."
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
        />
        <input
          className={styles.filterInput}
          placeholder="Filter by brand..."
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
        />
        <button className={styles.filterBtn} onClick={handleFilter}>
          Apply
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          {error.includes("POSTGRES_URL") && (
            <p className={styles.errorHint}>
              Usage tracking requires a Postgres database. Configure POSTGRES_URL to enable.
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className={styles.loading}>Loading usage data...</div>
      ) : data && data.usage.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Client</th>
                  <th>Brand</th>
                  <th>Purpose</th>
                  <th>Images</th>
                  <th>Quality</th>
                  <th>Cost</th>
                  <th>Duration</th>
                  <th>Cached</th>
                  <th>Via</th>
                </tr>
              </thead>
              <tbody>
                {data.usage.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.mono}>
                      {new Date(row.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <span className={styles.clientCell}>{row.client_name}</span>
                    </td>
                    <td>{row.brand}</td>
                    <td>{row.purpose}</td>
                    <td>{row.image_count}</td>
                    <td>
                      <span className={`${styles.qualityBadge} ${row.quality === "hd" ? styles.qualityHd : styles.qualityStd}`}>
                        {row.quality}
                      </span>
                    </td>
                    <td className={styles.mono}>${row.estimated_cost_usd.toFixed(3)}</td>
                    <td className={styles.mono}>{(row.processing_time_ms / 1000).toFixed(1)}s</td>
                    <td>{row.cached ? "Yes" : "No"}</td>
                    <td>
                      <span className={`${styles.endpointBadge} ${row.endpoint === "mcp" ? styles.endpointMcp : styles.endpointRest}`}>
                        {row.endpoint.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : !error ? (
        <div className={styles.empty}>
          No usage data yet. Generate some images to see usage stats here.
        </div>
      ) : null}
    </div>
  );
}
