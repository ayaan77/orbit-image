"use client";

import styles from "./BrandPreview.module.css";

interface BrandPreviewProps {
  readonly brandId: string;
}

export function BrandPreview({ brandId }: BrandPreviewProps) {
  if (!brandId) {
    return (
      <p className={styles.defaultNote}>
        Using the default brand — select one above to override.
      </p>
    );
  }

  return (
    <div className={styles.preview}>
      <div className={styles.previewLeft}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={styles.icon}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 8v4M12 16h.01"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className={styles.previewText}>
          Brand <span className={styles.brandHighlight}>{brandId}</span> will
          apply its colors, voice, and persona to your image.
        </span>
      </div>
    </div>
  );
}
