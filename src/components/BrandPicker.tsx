"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/client/api";
import styles from "./BrandPicker.module.css";

interface Brand {
  readonly id: string;
  readonly active: boolean;
}

interface BrandPickerProps {
  readonly value: string;
  readonly onChange: (brandId: string) => void;
}

export function BrandPicker({ value, onChange }: BrandPickerProps) {
  const [brands, setBrands] = useState<readonly Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch("/api/brands")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data.brands)) {
          setBrands(data.brands);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className={styles.loadingDot} style={{ animationDelay: "0ms" }} />
        <span className={styles.loadingDot} style={{ animationDelay: "150ms" }} />
        <span className={styles.loadingDot} style={{ animationDelay: "300ms" }} />
      </div>
    );
  }

  if (error || brands.length === 0) {
    return (
      <div className={styles.empty}>
        <p>
          {error
            ? "Could not load brands — using default."
            : "No brands found. Using the default brand."}
        </p>
        {error && (
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => {
              setError(false);
              setLoading(true);
              apiFetch("/api/brands")
                .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
                .then((data) => { if (Array.isArray(data.brands)) setBrands(data.brands); })
                .catch(() => setError(true))
                .finally(() => setLoading(false));
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.brandGrid}>
      {brands.map((brand) => (
        <button
          key={brand.id}
          type="button"
          className={`${styles.brandChip} ${
            value === brand.id ? styles.brandChipActive : ""
          } ${!brand.active ? styles.brandChipInactive : ""}`}
          onClick={() => onChange(value === brand.id ? "" : brand.id)}
        >
          <span className={styles.brandDot} />
          <span className={styles.brandName}>{brand.id}</span>
          {!brand.active && (
            <span className={styles.inactiveBadge}>inactive</span>
          )}
        </button>
      ))}
    </div>
  );
}
