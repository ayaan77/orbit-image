"use client";

import { MODEL_CATALOG, type ModelId } from "@/lib/providers/models";
import { estimateCost } from "@/lib/usage/cost";
import styles from "./GenerationSummary.module.css";

interface GenerationSummaryProps {
  readonly purpose: string;
  readonly model: ModelId;
  readonly quality: string;
  readonly count: number;
  readonly brand: string;
  readonly style: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  "blog-hero": "Blog Hero",
  "social-og": "Social / OG",
  "ad-creative": "Ad Creative",
  "case-study": "Case Study",
  icon: "Icon",
  infographic: "Infographic",
};

export function GenerationSummary({
  purpose,
  model,
  quality,
  count,
  brand,
  style,
}: GenerationSummaryProps) {
  const entry = MODEL_CATALOG[model];
  const cost = estimateCost(count, quality, model);

  return (
    <div className={styles.bar} aria-label="Generation configuration summary">
      <span className={styles.chip}>{PURPOSE_LABELS[purpose] ?? purpose}</span>
      <span className={`${styles.chip} ${styles.modelChip}`}>
        <span
          className={styles.dot}
          style={{ backgroundColor: `var(--provider-${entry.provider})` }}
        />
        {entry.displayName}
      </span>
      <span className={styles.chip}>{quality.toUpperCase()}</span>
      <span className={styles.chip}>
        {count} image{count > 1 ? "s" : ""}
      </span>
      {brand && <span className={styles.chip}>{brand}</span>}
      {style && <span className={styles.chip}>{style}</span>}
      <span className={styles.costChip}>~${cost.toFixed(3)}</span>
    </div>
  );
}
