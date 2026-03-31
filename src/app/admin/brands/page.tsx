"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import styles from "./page.module.css";

/* ─── Types ─── */

interface BrandItem {
  readonly id: string;
  readonly active: boolean;
}

interface BrandsResponse {
  readonly success: boolean;
  readonly brands: readonly BrandItem[];
  readonly error?: { readonly message: string };
}

interface ConfigResponse {
  readonly success: boolean;
  readonly config?: {
    readonly defaultBrand?: string;
  };
}

/* ─── Page ─── */

export default function BrandsPage() {
  const { showToast } = useToast();
  const [brands, setBrands] = useState<readonly BrandItem[]>([]);
  const [defaultBrand, setDefaultBrand] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [brandsRes, configRes] = await Promise.all([
        apiFetch("/api/brands"),
        apiFetch("/api/admin/config"),
      ]);

      if (!brandsRes.ok) {
        const body = await brandsRes.json().catch(() => null);
        throw new Error(
          body?.error?.message ?? `Failed to fetch brands (${brandsRes.status})`
        );
      }

      const brandsData: BrandsResponse = await brandsRes.json();
      if (!brandsData.success) {
        throw new Error(brandsData.error?.message ?? "Failed to fetch brands");
      }

      setBrands(brandsData.brands);

      if (configRes.ok) {
        const configData: ConfigResponse = await configRes.json();
        if (configData.success && configData.config?.defaultBrand) {
          setDefaultBrand(configData.config.defaultBrand);
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load brands";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTestConnection = useCallback(async () => {
    const slug = brandId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!slug) {
      showToast("Enter a brand ID", "error");
      return;
    }
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await apiFetch(`/api/brands`);
      if (!res.ok) throw new Error("Failed to reach Cortex");
      const data: BrandsResponse = await res.json();
      if (!data.success) throw new Error("Cortex returned an error");
      const found = data.brands.find((b) => b.id === slug);
      if (found) {
        setTestResult("success");
        showToast(`Brand "${slug}" found in Cortex!`, "success");
      } else {
        setTestResult("error");
        showToast(`Brand "${slug}" not found in Cortex`, "error");
      }
    } catch {
      setTestResult("error");
      showToast("Could not connect to Cortex", "error");
    } finally {
      setTesting(false);
    }
  }, [brandId, showToast]);

  const handleAddBrand = useCallback(() => {
    const slug = brandId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (testResult !== "success") {
      showToast("Test the connection first", "error");
      return;
    }
    if (brands.some((b) => b.id === slug)) {
      showToast(`Brand "${slug}" is already in the list`, "info");
    } else {
      showToast(`Brand "${slug}" is available in Cortex and ready to use`, "success");
    }
    setShowAddForm(false);
    setBrandId("");
    setTestResult("idle");
    fetchData();
  }, [brandId, testResult, brands, showToast, fetchData]);

  const cortexUrl = brandId.trim()
    ? `https://cortex.apexure.com/api/mcp?brand=${encodeURIComponent(brandId.trim().toLowerCase())}`
    : "";

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>Brands</h1>
          <p className={styles.subtitle}>
            Brand data from Cortex. Each brand provides colors, voice, audience, and
            proof for image generation.
          </p>
        </div>
        <button
          className={styles.addBtn}
          onClick={() => { setShowAddForm(!showAddForm); setTestResult("idle"); }}
        >
          {showAddForm ? "Cancel" : "+ Add Brand"}
        </button>
      </div>

      {/* ─── Add Brand Form ─── */}
      {showAddForm && (
        <div className={styles.addForm}>
          <div className={styles.addFormHeader}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2 2 0 002-2c0-.53-.2-1-.55-1.35-.35-.38-.55-.83-.55-1.35a2 2 0 012-2h2.35c3.27 0 5.94-2.5 5.94-5.58C21.29 5.93 17.22 2 12 2z" />
            </svg>
            <span>Connect a Brand from Cortex</span>
          </div>

          <div className={styles.addFormFields}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Brand ID *</label>
              <input
                className={styles.formInput}
                value={brandId}
                onChange={(e) => { setBrandId(e.target.value); setTestResult("idle"); }}
                placeholder="e.g. my-company, apexure"
              />
            </div>

            {cortexUrl && (
              <div className={styles.urlPreview}>
                <span className={styles.urlLabel}>Cortex MCP URL</span>
                <code className={styles.urlValue}>{cortexUrl}</code>
              </div>
            )}

            {testResult === "success" && (
              <div className={styles.testSuccess}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Brand found in Cortex — colors, voice, and personas available
              </div>
            )}

            {testResult === "error" && (
              <div className={styles.testError}>
                Brand not found or Cortex unreachable. Check the brand ID.
              </div>
            )}
          </div>

          <div className={styles.addFormActions}>
            <button
              className={styles.testBtn}
              onClick={handleTestConnection}
              disabled={testing || !brandId.trim()}
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              className={styles.confirmBtn}
              onClick={handleAddBrand}
              disabled={testResult !== "success"}
            >
              Add Brand
            </button>
          </div>
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && brands.length === 0 && <EmptyState />}

      {!loading && !error && brands.length > 0 && (
        <>
          <p className={styles.brandCount}>
            {brands.length} brand{brands.length !== 1 ? "s" : ""} found
          </p>
          <div className={styles.brandList}>
            {brands.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                isDefault={brand.id === defaultBrand}
                onCopySuccess={() =>
                  showToast("Brand ID copied to clipboard", "success")
                }
                onCopyError={() =>
                  showToast("Failed to copy to clipboard", "error")
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Brand Card ─── */

interface BrandCardProps {
  readonly brand: BrandItem;
  readonly isDefault: boolean;
  readonly onCopySuccess: () => void;
  readonly onCopyError: () => void;
}

function BrandCard({
  brand,
  isDefault,
  onCopySuccess,
  onCopyError,
}: BrandCardProps) {
  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(brand.id);
      onCopySuccess();
    } catch {
      onCopyError();
    }
  };

  const contextItems = [
    { label: "Colors", icon: paletteIcon },
    { label: "Voice", icon: voiceIcon },
    { label: "Personas", icon: personasIcon },
    { label: "Proof", icon: proofIcon },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.cardGlow} />

      {/* Header */}
      <div className={styles.cardHeader}>
        <span className={styles.brandDot} />
        <button
          type="button"
          onClick={handleCopyId}
          className={styles.brandName}
          title="Click to copy brand ID"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {brand.id}
        </button>
        <div className={styles.badges}>
          {isDefault && <span className={styles.badgeDefault}>Default</span>}
          <span
            className={
              brand.active ? styles.badgeActive : styles.badgeInactive
            }
          >
            {brand.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={styles.cardBody}>
        <p className={styles.contextNote}>
          Brand context (colors, voice, personas, proof) is pulled from Cortex
          at generation time.
        </p>
        <div className={styles.contextItems}>
          {contextItems.map((item) => (
            <span key={item.label} className={styles.contextTag}>
              <svg
                className={styles.contextTagIcon}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {item.icon}
              </svg>
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Inline SVG path fragments ─── */

const paletteIcon = (
  <>
    <circle cx="5" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="6" r="1" fill="currentColor" stroke="none" />
    <path d="M8 1.5a6.5 6.5 0 00-.5 13 1 1 0 001-1c0-.3-.1-.5-.3-.7a1 1 0 01.7-1.7H10c1.8 0 3.3-1.3 3.3-2.9A5.4 5.4 0 008 1.5z" />
  </>
);

const voiceIcon = (
  <path d="M3 5h10a1 1 0 011 1v4a1 1 0 01-1 1H9l-3 2.5V11H3a1 1 0 01-1-1V6a1 1 0 011-1z" />
);

const personasIcon = (
  <>
    <circle cx="6" cy="5" r="2" />
    <path d="M2 13c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5" />
    <circle cx="11" cy="5.5" r="1.5" />
    <path d="M11.5 9.5c1.2.2 2 1.2 2 2.5" />
  </>
);

const proofIcon = (
  <>
    <path d="M2 3h12v10H2z" />
    <path d="M5 7h6M5 9.5h4" />
  </>
);

/* ─── Loading Skeleton ─── */

function LoadingSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skeletonCard} />
      <div className={styles.skeletonCard} />
      <div className={styles.skeletonCard} />
    </div>
  );
}

/* ─── Empty State ─── */

function EmptyState() {
  return (
    <div className={styles.empty}>
      <svg
        className={styles.emptyIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2 2 0 002-2c0-.53-.2-1-.55-1.35-.35-.38-.55-.83-.55-1.35a2 2 0 012-2h2.35c3.27 0 5.94-2.5 5.94-5.58C21.29 5.93 17.22 2 12 2z" />
        <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" />
        <circle cx="10.5" cy="7.5" r="1.5" fill="currentColor" />
        <circle cx="15.5" cy="7.5" r="1.5" fill="currentColor" />
      </svg>
      <p className={styles.emptyText}>
        No brands available. Make sure Cortex is connected in the setup
        checklist.
      </p>
    </div>
  );
}
