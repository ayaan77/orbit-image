"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { MODEL_CATALOG, type ModelId } from "@/lib/providers/models";
import styles from "./HistoryDrawer.module.css";

interface GeneratedImage {
  readonly base64: string;
  readonly url?: string; // Blob URL or thumbnail data URL — used when base64 is empty
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

export interface HistoryEntry {
  readonly id: string;
  readonly images: readonly GeneratedImage[];
  readonly brand: string;
  readonly purpose: string;
  readonly topic: string;
  readonly processingTimeMs: number;
  readonly cortexDataCached: boolean;
  readonly resultCached: boolean;
  readonly generatedAt: number;
  readonly model?: string;
  readonly style?: string;
  readonly estimatedCostUsd?: number;
}

interface HistoryDrawerProps {
  readonly isOpen: boolean;
  readonly entries: readonly HistoryEntry[];
  readonly onClose: () => void;
  readonly onRestore: (entry: HistoryEntry) => void;
  readonly onRerun?: (entry: HistoryEntry, overrides?: { model?: string }) => void;
}

type FilterKey = "model" | "brand" | "purpose";

export function HistoryDrawer({
  isOpen,
  entries,
  onClose,
  onRestore,
  onRerun,
}: HistoryDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    model: "",
    brand: "",
    purpose: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Derive unique filter values from entries
  const filterOptions = useMemo(() => ({
    model: [...new Set(entries.map((e) => e.model).filter(Boolean))] as string[],
    brand: [...new Set(entries.map((e) => e.brand).filter(Boolean))],
    purpose: [...new Set(entries.map((e) => e.purpose).filter(Boolean))],
  }), [entries]);

  const filteredEntries = useMemo(() =>
    entries.filter((e) => {
      if (filters.model && e.model !== filters.model) return false;
      if (filters.brand && e.brand !== filters.brand) return false;
      if (filters.purpose && e.purpose !== filters.purpose) return false;
      return true;
    }),
    [entries, filters]
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const toggleFilter = (key: FilterKey, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? "" : value,
    }));
  };

  const clearFilters = () => setFilters({ model: "", brand: "", purpose: "" });

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Generation history"
      >
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>History</span>
            {entries.length > 0 && (
              <span className={styles.entryCount}>{entries.length}</span>
            )}
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close history"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path
                d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Filters */}
        {entries.length > 0 && (
          <div className={styles.filterBar}>
            {filterOptions.model.length > 1 && filterOptions.model.map((m) => {
              const entry = MODEL_CATALOG[m as ModelId];
              return (
                <button
                  key={m}
                  className={`${styles.filterChip} ${filters.model === m ? styles.filterChipActive : ""}`}
                  onClick={() => toggleFilter("model", m)}
                >
                  {entry?.displayName ?? m}
                </button>
              );
            })}
            {filterOptions.brand.length > 1 && filterOptions.brand.map((b) => (
              <button
                key={b}
                className={`${styles.filterChip} ${filters.brand === b ? styles.filterChipActive : ""}`}
                onClick={() => toggleFilter("brand", b)}
              >
                {b}
              </button>
            ))}
            {filterOptions.purpose.length > 1 && filterOptions.purpose.map((p) => (
              <button
                key={p}
                className={`${styles.filterChip} ${filters.purpose === p ? styles.filterChipActive : ""}`}
                onClick={() => toggleFilter("purpose", p)}
              >
                {p}
              </button>
            ))}
            {hasActiveFilters && (
              <button className={styles.clearFilters} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        )}

        <div className={styles.drawerBody}>
          {filteredEntries.length === 0 ? (
            <div className={styles.empty}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className={styles.emptyIcon}>
                <path
                  d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className={styles.emptyText}>
                {hasActiveFilters ? "No matching entries." : "No generations yet."}
              </p>
              <p className={styles.emptyHint}>
                {hasActiveFilters
                  ? "Try adjusting your filters."
                  : "Generated images will appear here — up to 20 entries."}
              </p>
            </div>
          ) : (
            <ul className={styles.entryList}>
              {filteredEntries.map((entry) => {
                const firstImage = entry.images[0];
                const timeAgo = formatTimeAgo(entry.generatedAt);
                const modelEntry = entry.model ? MODEL_CATALOG[entry.model as ModelId] : null;
                return (
                  <li key={entry.id} className={styles.entry}>
                    {firstImage && (
                      <div className={styles.thumb}>
                        <img
                          src={
                            firstImage.url ||
                            (firstImage.base64
                              ? `data:${firstImage.mimeType};base64,${firstImage.base64}`
                              : undefined)
                          }
                          alt={`Generated for ${entry.brand}`}
                          className={styles.thumbImg}
                        />
                        {entry.images.length > 1 && (
                          <span className={styles.thumbCount}>
                            +{entry.images.length - 1}
                          </span>
                        )}
                      </div>
                    )}
                    <div className={styles.entryInfo}>
                      <p className={styles.entryTopic}>{entry.topic}</p>
                      <div className={styles.entryMeta}>
                        <span className={styles.entryBrand}>{entry.brand}</span>
                        <span className={styles.entryDot} />
                        <span className={styles.entryDetail}>{entry.purpose}</span>
                        {modelEntry && (
                          <>
                            <span className={styles.entryDot} />
                            <span className={styles.entryModel}>
                              <span
                                className={styles.modelDotSmall}
                                style={{ backgroundColor: `var(--provider-${modelEntry.provider})` }}
                              />
                              {modelEntry.displayName}
                            </span>
                          </>
                        )}
                        {entry.estimatedCostUsd != null && (
                          <>
                            <span className={styles.entryDot} />
                            <span className={styles.entryCost}>${entry.estimatedCostUsd.toFixed(3)}</span>
                          </>
                        )}
                        <span className={styles.entryDot} />
                        <span className={styles.entryDetail}>{timeAgo}</span>
                      </div>
                    </div>
                    <div className={styles.entryActions}>
                      <button
                        className={styles.restoreBtn}
                        onClick={() => {
                          onRestore(entry);
                          onClose();
                        }}
                      >
                        Restore
                      </button>
                      {onRerun && (
                        <button
                          className={styles.rerunBtn}
                          onClick={() => {
                            onRerun(entry);
                            onClose();
                          }}
                        >
                          Re-run
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}
