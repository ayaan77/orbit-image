"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import styles from "./page.module.css";

type Purpose = "blog-hero" | "social-og" | "ad-creative" | "case-study" | "icon" | "infographic";

interface GeneratedImage {
  readonly url?: string;
  readonly base64?: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface GenerateResult {
  readonly images: readonly GeneratedImage[];
  readonly brand: string;
  readonly metadata: {
    readonly processingTimeMs: number;
    readonly brandContextUsed: boolean;
    readonly demo: boolean;
  };
}

interface BrandOption {
  readonly id: string;
  readonly connected: boolean;
}

const PURPOSES: readonly { readonly id: Purpose; readonly label: string; readonly primary: boolean }[] = [
  { id: "blog-hero", label: "Blog Hero", primary: true },
  { id: "social-og", label: "Social", primary: true },
  { id: "ad-creative", label: "Ad", primary: true },
  { id: "case-study", label: "Case Study", primary: false },
  { id: "icon", label: "Icon", primary: false },
  { id: "infographic", label: "Infographic", primary: false },
];

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [brand, setBrand] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("blog-hero");
  const [showMore, setShowMore] = useState(false);
  const [brands, setBrands] = useState<readonly BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = topic.trim().length >= 3;

  // Load brands
  useEffect(() => {
    async function load() {
      try {
        // Try connected brands first
        const connRes = await apiFetch("/api/admin/brands");
        if (connRes.ok) {
          const data = await connRes.json();
          if (data.success && Array.isArray(data.connections) && data.connections.length > 0) {
            const connected = data.connections
              .filter((c: { connected: boolean }) => c.connected)
              .map((c: { brandId: string }) => ({ id: c.brandId, connected: true }));
            if (connected.length > 0) {
              setBrands(connected);
              setBrandsLoading(false);
              return;
            }
          }
        }
        // Fallback to Cortex brands
        const res = await apiFetch("/api/brands");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.brands)) {
            setBrands(data.brands.filter((b: { active: boolean }) => b.active).map((b: { id: string }) => ({ id: b.id, connected: false })));
          }
        }
      } catch {
        // Brands optional
      } finally {
        setBrandsLoading(false);
      }
    }
    load();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const body: Record<string, string> = { topic: topic.trim(), purpose };
      if (brand) body.brand = brand;
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Generation failed");
        return;
      }
      setGenerated(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [topic, purpose, brand, canSubmit]);

  const handleDownload = useCallback(() => {
    const img = generated?.images[0];
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url ?? `data:${img.mimeType};base64,${img.base64}`;
    a.download = "orbit-image.png";
    a.click();
  }, [generated]);

  const imageUrl = generated?.images[0]?.url
    ?? (generated?.images[0]?.base64
      ? `data:${generated.images[0].mimeType};base64,${generated.images[0].base64}`
      : null);

  const hasResult = generated && imageUrl && !loading;
  const primaryPurposes = PURPOSES.filter((p) => p.primary);
  const morePurposes = PURPOSES.filter((p) => !p.primary);
  const isMoreSelected = morePurposes.some((p) => p.id === purpose);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBox}>O</span>
          <span className={styles.logoText}>Studio</span>
        </Link>
        <Link href="/" className={styles.backLink}>← Dashboard</Link>
      </header>

      <div className={styles.main}>
        {!hasResult ? (
          /* ─── Input View ─── */
          <div className={styles.inputView}>
            <h1 className={styles.title}>What image do you need?</h1>

            <textarea
              className={styles.topicInput}
              placeholder="A modern SaaS dashboard showing real-time analytics with a dark theme..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              rows={3}
            />

            {/* Brand Selector */}
            {!brandsLoading && brands.length > 0 && (
              <div className={styles.brandRow}>
                <button
                  className={`${styles.brandChip} ${!brand ? styles.brandChipActive : ""}`}
                  onClick={() => setBrand("")}
                  type="button"
                >
                  Auto
                </button>
                {brands.map((b) => (
                  <button
                    key={b.id}
                    className={`${styles.brandChip} ${brand === b.id ? styles.brandChipActive : ""}`}
                    onClick={() => setBrand(brand === b.id ? "" : b.id)}
                    type="button"
                  >
                    <span className={styles.brandDot} />
                    {b.id}
                  </button>
                ))}
              </div>
            )}

            {/* Purpose */}
            <div className={styles.purposeRow}>
              {primaryPurposes.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.purposeChip} ${purpose === p.id ? styles.purposeChipActive : ""}`}
                  onClick={() => setPurpose(p.id)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
              <button
                className={`${styles.purposeChip} ${isMoreSelected ? styles.purposeChipActive : ""} ${showMore ? styles.purposeChipActive : ""}`}
                onClick={() => setShowMore(!showMore)}
                type="button"
              >
                {isMoreSelected ? morePurposes.find((p) => p.id === purpose)?.label : "More ▾"}
              </button>
            </div>

            {showMore && (
              <div className={styles.moreRow}>
                {morePurposes.map((p) => (
                  <button
                    key={p.id}
                    className={`${styles.purposeChip} ${purpose === p.id ? styles.purposeChipActive : ""}`}
                    onClick={() => { setPurpose(p.id); setShowMore(false); }}
                    type="button"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {/* Generate */}
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={!canSubmit || loading}
              type="button"
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </button>

            {error && <div className={styles.error}>{error}</div>}

            <p className={styles.hint}>
              3 free generations per day{brand ? ` · Using ${brand} brand` : " · Brand context applied automatically"}
            </p>
          </div>
        ) : (
          /* ─── Result View ─── */
          <div className={styles.resultView}>
            <div className={styles.imageContainer}>
              <img
                className={styles.resultImage}
                src={imageUrl}
                alt="Generated image"
                width={generated.images[0].dimensions.width}
                height={generated.images[0].dimensions.height}
              />
            </div>

            <div className={styles.metaBar}>
              <span className={styles.metaBrand}>
                {generated.metadata.brandContextUsed
                  ? <><span className={styles.metaDot} />{generated.brand}</>
                  : "No brand context"}
              </span>
              <span className={styles.metaTime}>
                {(generated.metadata.processingTimeMs / 1000).toFixed(1)}s
              </span>
            </div>

            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleDownload} type="button">
                Download
              </button>
              <button
                className={styles.actionBtnPrimary}
                onClick={() => { setGenerated(null); setError(null); }}
                type="button"
              >
                Generate Another
              </button>
            </div>

            <div className={styles.cta}>
              <p className={styles.ctaText}>Want unlimited access? Connect via MCP or API.</p>
              <Link href="/" className={styles.ctaLink}>Open Dashboard →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
