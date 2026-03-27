"use client";

import { useState, useEffect } from "react";
import { getApiKey } from "@/lib/client/storage";
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
    const key = getApiKey();
    if (!key) {
      setLoading(false);
      return;
    }
    fetch("/api/brands", {
      headers: { Authorization: `Bearer ${key}` },
    })
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
      <p className={styles.empty}>
        {error
          ? "Could not load brands — using default."
          : "No brands found. Using the default brand."}
      </p>
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
