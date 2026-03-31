"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { MODEL_CATALOG, MODEL_IDS } from "@/lib/providers/models";
import type { ModelId } from "@/lib/providers/models";
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

interface HistoryItem {
  readonly topic: string;
  readonly purpose: string;
  readonly brand: string;
  readonly imageUrl: string;
  readonly timestamp: number;
}

const HISTORY_KEY = "orbit-studio-history";

function loadHistory(): readonly HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(item: HistoryItem): readonly HistoryItem[] {
  const history = [...loadHistory()];
  history.unshift(item);
  const trimmed = history.slice(0, 3);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

const STUDIO_MODELS: readonly ModelId[] = MODEL_IDS.filter(
  (id) => id !== "grok-aurora"
);

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

  // Feature 1: Brand color preview
  const [brandColors, setBrandColors] = useState<Record<string, string[]>>({});
  const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);
  const brandFetchingRef = useRef<Set<string>>(new Set());

  // Feature 2: Generation history
  const [history, setHistory] = useState<readonly HistoryItem[]>([]);

  // Feature 3: Share button
  const [shareLabel, setShareLabel] = useState("Share");

  // Feature 4: Advanced model selector
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [model, setModel] = useState<string>("");

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

  // Load history from localStorage
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Feature 1: Lazy fetch brand colors on hover
  const handleBrandHover = useCallback(async (brandId: string) => {
    setHoveredBrand(brandId);
    if (brandColors[brandId] || brandFetchingRef.current.has(brandId)) return;
    brandFetchingRef.current.add(brandId);
    try {
      const res = await apiFetch(`/api/admin/brands/${brandId}`);
      if (res.ok) {
        const data = await res.json();
        const colors: string[] = Array.isArray(data.colors)
          ? data.colors.slice(0, 4)
          : Array.isArray(data.brand?.colors)
            ? data.brand.colors.slice(0, 4)
            : [];
        if (colors.length > 0) {
          setBrandColors((prev) => ({ ...prev, [brandId]: colors }));
        }
      }
    } catch {
      // Colors are optional — fail silently
    }
  }, [brandColors]);

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const body: Record<string, string> = { topic: topic.trim(), purpose };
      if (brand) body.brand = brand;
      if (model) body.model = model;
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

      // Save to history
      const img = json.images?.[0];
      const imgUrl = img?.url ?? (img?.base64 ? `data:${img.mimeType};base64,${img.base64}` : "");
      if (imgUrl) {
        const updated = saveHistory({
          topic: topic.trim(),
          purpose,
          brand: brand || json.brand || "",
          imageUrl: imgUrl,
          timestamp: Date.now(),
        });
        setHistory(updated);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [topic, purpose, brand, model, canSubmit]);

  const handleDownload = useCallback(() => {
    const img = generated?.images[0];
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url ?? `data:${img.mimeType};base64,${img.base64}`;
    a.download = "orbit-image.png";
    a.click();
  }, [generated]);

  // Feature 3: Share handler
  const handleShare = useCallback(async () => {
    const img = generated?.images[0];
    if (!img) return;
    const url = img.url ?? (img.base64 ? `data:${img.mimeType};base64,${img.base64}` : null);
    if (!url) return;

    if (typeof navigator.share === "function" && img.url) {
      try {
        await navigator.share({ title: "Orbit Image", url: img.url });
      } catch {
        // User cancelled or share failed — ignore
      }
      return;
    }

    if (img.url) {
      try {
        await navigator.clipboard.writeText(img.url);
        setShareLabel("Copied!");
        setTimeout(() => setShareLabel("Share"), 2000);
      } catch {
        setShareLabel("Share not available");
        setTimeout(() => setShareLabel("Share"), 2000);
      }
      return;
    }

    setShareLabel("Share not available");
    setTimeout(() => setShareLabel("Share"), 2000);
  }, [generated]);

  // Feature 2: Click history item to show in result view
  const handleHistoryClick = useCallback((item: HistoryItem) => {
    setGenerated({
      images: [{
        url: item.imageUrl,
        mimeType: "image/png",
        dimensions: { width: 1024, height: 1024 },
      }],
      brand: item.brand,
      metadata: {
        processingTimeMs: 0,
        brandContextUsed: !!item.brand,
        demo: false,
      },
    });
  }, []);

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
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit && !loading) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              maxLength={500}
              rows={3}
            />

            {/* Brand Selector */}
            {!brandsLoading && brands.length > 0 && (
              <div className={styles.brandSection}>
                <div className={styles.brandRow}>
                  <button
                    className={`${styles.brandChip} ${!brand ? styles.brandChipActive : ""}`}
                    onClick={() => setBrand("")}
                    type="button"
                  >
                    Auto
                  </button>
                  {brands.map((b) => (
                    <div
                      key={b.id}
                      className={styles.brandChipWrapper}
                      onMouseEnter={() => handleBrandHover(b.id)}
                      onMouseLeave={() => setHoveredBrand(null)}
                    >
                      <button
                        className={`${styles.brandChip} ${brand === b.id ? styles.brandChipActive : ""}`}
                        onClick={() => setBrand(brand === b.id ? "" : b.id)}
                        type="button"
                      >
                        <span className={styles.brandDot} />
                        {b.id}
                      </button>
                      {hoveredBrand === b.id && brandColors[b.id] && brandColors[b.id].length > 0 && (
                        <div className={styles.brandTooltip}>
                          {brandColors[b.id].map((color, i) => (
                            <span
                              key={i}
                              className={styles.brandColorDot}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className={styles.brandHint}>
                  {brand
                    ? <>Images will use <strong>{brand}</strong>&apos;s colors, voice &amp; audience</>
                    : "Default brand applied — colors and style matched automatically"}
                </p>
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

            {/* Advanced / Model Selector */}
            <button
              className={styles.advancedToggle}
              onClick={() => setShowAdvanced(!showAdvanced)}
              type="button"
            >
              {showAdvanced ? "Hide advanced" : "Advanced"}
            </button>

            {showAdvanced && (
              <div className={styles.modelRow}>
                <button
                  className={`${styles.purposeChip} ${model === "" ? styles.purposeChipActive : ""}`}
                  onClick={() => setModel("")}
                  type="button"
                >
                  Auto
                </button>
                {STUDIO_MODELS.map((id) => (
                  <button
                    key={id}
                    className={`${styles.purposeChip} ${model === id ? styles.purposeChipActive : ""}`}
                    onClick={() => setModel(model === id ? "" : id)}
                    type="button"
                  >
                    {MODEL_CATALOG[id].displayName}
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
              3 free per day · ⌘Enter to generate
            </p>

            {/* History */}
            {history.length > 0 && (
              <div className={styles.historySection}>
                <p className={styles.historyLabel}>Recent</p>
                <div className={styles.historyRow}>
                  {history.map((item, i) => (
                    <button
                      key={item.timestamp}
                      className={styles.historyCard}
                      onClick={() => handleHistoryClick(item)}
                      type="button"
                      aria-label={`View previous generation: ${item.topic}`}
                    >
                      <img
                        className={styles.historyThumb}
                        src={item.imageUrl}
                        alt={`Generation ${i + 1}`}
                      />
                      <div className={styles.historyInfo}>
                        <span className={styles.historyTopic}>{item.topic}</span>
                        {item.brand && <span className={styles.historyBrand}>{item.brand}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              {generated.metadata.brandContextUsed ? (
                <span className={styles.metaBrand}>
                  <span className={styles.metaDotGreen} />
                  <strong>{generated.brand}</strong> brand colors &amp; voice applied
                </span>
              ) : (
                <span className={styles.metaBrandWarn}>
                  <span className={styles.metaDotAmber} />
                  Generic — brand context unavailable
                </span>
              )}
              <span className={styles.metaTime}>
                {(generated.metadata.processingTimeMs / 1000).toFixed(1)}s
              </span>
            </div>

            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleDownload} type="button">
                Download
              </button>
              <button className={styles.actionBtn} onClick={handleShare} type="button">
                {shareLabel}
              </button>
              <button
                className={styles.actionBtnPrimary}
                onClick={() => { setGenerated(null); setError(null); setShareLabel("Share"); }}
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
