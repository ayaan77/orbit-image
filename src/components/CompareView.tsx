"use client";

import { useState, useCallback } from "react";
import { MODEL_CATALOG, MODEL_IDS, type ModelId } from "@/lib/providers/models";
import { estimateCost } from "@/lib/usage/cost";
import { apiFetch } from "@/lib/client/api";
import type { ProviderStatus } from "@/lib/client/useProviderStatus";
import styles from "./CompareView.module.css";

interface GeneratedImage {
  readonly base64: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface CompareResult {
  readonly images: readonly GeneratedImage[];
  readonly processingTimeMs: number;
  readonly model: string;
}

type CompareState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly result: CompareResult }
  | { readonly status: "error"; readonly message: string };

interface CompareViewProps {
  readonly originalImage: GeneratedImage;
  readonly originalModel: string;
  readonly originalTimeMs: number;
  readonly topic: string;
  readonly purpose: string;
  readonly brand: string;
  readonly quality: string;
  readonly style?: string;
  readonly providerStatus: ProviderStatus | null;
  readonly onClose: () => void;
}

export function CompareView({
  originalImage,
  originalModel,
  originalTimeMs,
  topic,
  purpose,
  brand,
  quality,
  style,
  providerStatus,
  onClose,
}: CompareViewProps) {
  const [compareModel, setCompareModel] = useState<ModelId | "">("");
  const [state, setState] = useState<CompareState>({ status: "idle" });

  const availableModels = (providerStatus?.availableModels ?? []).filter(
    (m) => m !== originalModel
  );

  const handleGenerate = useCallback(async () => {
    if (!compareModel) return;
    setState({ status: "loading" });

    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          topic,
          purpose,
          brand: brand || undefined,
          quality,
          model: compareModel,
          count: 1,
          output_format: "base64",
          ...(style ? { style } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? `Failed (${res.status})`);
      }

      const data = await res.json();
      setState({
        status: "success",
        result: {
          images: data.images,
          processingTimeMs: data.metadata.processingTimeMs,
          model: compareModel,
        },
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Generation failed",
      });
    }
  }, [compareModel, topic, purpose, brand, quality, style]);

  const originalEntry = MODEL_CATALOG[originalModel as ModelId];
  const compareEntry = compareModel ? MODEL_CATALOG[compareModel] : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3 className={styles.title}>Compare Models</h3>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close comparison">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Model picker */}
      <div className={styles.pickerRow}>
        <span className={styles.pickerLabel}>Compare with:</span>
        <select
          className={styles.modelSelect}
          value={compareModel}
          onChange={(e) => {
            setCompareModel(e.target.value as ModelId);
            setState({ status: "idle" });
          }}
        >
          <option value="">Select a model...</option>
          {availableModels.map((id) => {
            const entry = MODEL_CATALOG[id as ModelId];
            return (
              <option key={id} value={id}>
                {entry?.displayName ?? id} ({entry?.badge})
              </option>
            );
          })}
        </select>
        <button
          className={styles.goBtn}
          onClick={handleGenerate}
          disabled={!compareModel || state.status === "loading"}
        >
          {state.status === "loading" ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Split comparison */}
      <div className={styles.splitPane}>
        {/* Original */}
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            {originalEntry && (
              <span className={styles.paneBadge}>
                <span className={styles.paneDot} style={{ backgroundColor: `var(--provider-${originalEntry.provider})` }} />
                {originalEntry.displayName}
              </span>
            )}
            <span className={styles.paneMeta}>{(originalTimeMs / 1000).toFixed(1)}s</span>
            <span className={styles.paneMeta}>~${estimateCost(1, quality, originalModel).toFixed(3)}</span>
          </div>
          <img
            className={styles.paneImage}
            src={`data:${originalImage.mimeType};base64,${originalImage.base64}`}
            alt="Original generation"
          />
        </div>

        {/* Comparison */}
        <div className={styles.pane}>
          {state.status === "idle" && (
            <div className={styles.paneEmpty}>
              {compareModel ? "Click Generate to compare" : "Select a model to compare"}
            </div>
          )}
          {state.status === "loading" && (
            <div className={styles.paneLoading}>
              <span className={styles.spinner} />
              Generating with {compareEntry?.displayName}...
            </div>
          )}
          {state.status === "error" && (
            <div className={styles.paneError}>{state.message}</div>
          )}
          {state.status === "success" && state.result.images[0] && (
            <>
              <div className={styles.paneHeader}>
                {compareEntry && (
                  <span className={styles.paneBadge}>
                    <span className={styles.paneDot} style={{ backgroundColor: `var(--provider-${compareEntry.provider})` }} />
                    {compareEntry.displayName}
                  </span>
                )}
                <span className={styles.paneMeta}>{(state.result.processingTimeMs / 1000).toFixed(1)}s</span>
                <span className={styles.paneMeta}>~${estimateCost(1, quality, compareModel).toFixed(3)}</span>
              </div>
              <img
                className={styles.paneImage}
                src={`data:${state.result.images[0].mimeType};base64,${state.result.images[0].base64}`}
                alt="Comparison generation"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
