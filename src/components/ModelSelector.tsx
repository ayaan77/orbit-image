"use client";

import { useMemo } from "react";
import { MODEL_CATALOG, MODEL_IDS, type ModelId } from "@/lib/providers/models";
import { getPerImageCost } from "@/lib/usage/cost";
import type { ProviderStatus } from "@/lib/client/useProviderStatus";
import styles from "./ModelSelector.module.css";

type ProviderName = "openai" | "replicate" | "xai";

const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: "OpenAI",
  replicate: "Replicate",
  xai: "xAI",
};

const TIER_LABELS: Record<string, string> = {
  fast: "Fast",
  standard: "Standard",
  premium: "Premium",
};

/** Smart default model recommendations based on purpose. */
const PURPOSE_RECOMMENDATIONS: Record<string, ModelId[]> = {
  "blog-hero": ["gpt-image-1", "flux-dev"],
  "social-og": ["gpt-image-1", "flux-dev"],
  "ad-creative": ["dall-e-3", "flux-pro"],
  "case-study": ["dall-e-3", "flux-pro"],
  icon: ["flux-schnell", "gpt-image-1"],
  infographic: ["gpt-image-1", "dall-e-3"],
};

function getRecommendedModel(
  purpose: string,
  availableModels: readonly string[]
): ModelId | null {
  const candidates = PURPOSE_RECOMMENDATIONS[purpose] ?? [];
  return (candidates.find((m) => availableModels.includes(m)) as ModelId) ?? null;
}

interface ModelSelectorProps {
  readonly value: ModelId;
  readonly onChange: (model: ModelId) => void;
  readonly purpose: string;
  readonly quality: string;
  readonly providerStatus: ProviderStatus | null;
}

export function ModelSelector({
  value,
  onChange,
  purpose,
  quality,
  providerStatus,
}: ModelSelectorProps) {
  const availableModels = providerStatus?.availableModels ?? [];
  const recommended = useMemo(
    () => getRecommendedModel(purpose, availableModels),
    [purpose, availableModels]
  );

  const selectedEntry = MODEL_CATALOG[value];
  const costPerImage = getPerImageCost(value, quality);

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>
        <span>Model</span>
        <span className={styles.summary}>
          {selectedEntry.displayName} &middot;{" "}
          <span className={styles[`tier${selectedEntry.tier}`]}>
            {TIER_LABELS[selectedEntry.tier]}
          </span>{" "}
          &middot; ~${costPerImage.toFixed(3)}/image
        </span>
      </div>

      <div className={styles.strip} role="radiogroup" aria-label="Select AI model">
        {MODEL_IDS.map((id) => {
          const entry = MODEL_CATALOG[id];
          const provider = entry.provider as ProviderName;
          const isConfigured = providerStatus
            ? providerStatus.providers[provider].configured
            : true; // Assume configured if status not loaded yet
          const isSelected = id === value;
          const isRecommended = id === recommended;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${entry.displayName} by ${PROVIDER_LABELS[provider]}${!isConfigured ? " (not configured)" : ""}`}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${!isConfigured ? styles.cardLocked : ""}`}
              onClick={() => isConfigured && onChange(id)}
              disabled={!isConfigured}
            >
              {isRecommended && (
                <span className={styles.recommendedBadge}>Recommended</span>
              )}

              <div className={styles.cardHeader}>
                <span
                  className={styles.providerDot}
                  style={{ backgroundColor: `var(--provider-${provider})` }}
                  aria-hidden="true"
                />
                <span className={styles.providerLabel}>
                  {PROVIDER_LABELS[provider]}
                </span>
              </div>

              <span className={styles.modelName}>{entry.displayName}</span>

              <div className={styles.cardFooter}>
                <span className={`${styles.tierBadge} ${styles[`tier${entry.tier}`]}`}>
                  {TIER_LABELS[entry.tier]}
                </span>
                <span className={styles.costHint}>
                  ${getPerImageCost(id, quality).toFixed(3)}
                </span>
              </div>

              {!isConfigured && (
                <div className={styles.lockOverlay} aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>Configure</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
