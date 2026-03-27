"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./HistoryDrawer.module.css";

interface GeneratedImage {
  readonly base64: string;
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
}

interface HistoryDrawerProps {
  readonly isOpen: boolean;
  readonly entries: readonly HistoryEntry[];
  readonly onClose: () => void;
  readonly onRestore: (entry: HistoryEntry) => void;
}

export function HistoryDrawer({
  isOpen,
  entries,
  onClose,
  onRestore,
}: HistoryDrawerProps) {
  const [mounted, setMounted] = useState(false);

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

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
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

        <div className={styles.drawerBody}>
          {entries.length === 0 ? (
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
              <p className={styles.emptyText}>No generations yet.</p>
              <p className={styles.emptyHint}>
                Generated images will appear here — up to 20 entries.
              </p>
            </div>
          ) : (
            <ul className={styles.entryList}>
              {entries.map((entry) => {
                const firstImage = entry.images[0];
                const timeAgo = formatTimeAgo(entry.generatedAt);
                return (
                  <li key={entry.id} className={styles.entry}>
                    {firstImage && (
                      <div className={styles.thumb}>
                        <img
                          src={`data:${firstImage.mimeType};base64,${firstImage.base64}`}
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
                        <span className={styles.entryDot} />
                        <span className={styles.entryDetail}>{timeAgo}</span>
                      </div>
                    </div>
                    <button
                      className={styles.restoreBtn}
                      onClick={() => {
                        onRestore(entry);
                        onClose();
                      }}
                    >
                      Restore
                    </button>
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
