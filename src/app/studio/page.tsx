"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { MODEL_CATALOG } from "@/lib/providers/models";
import type { ModelId } from "@/lib/providers/models";
import { useProviderStatus } from "@/lib/client/useProviderStatus";
import { ModelSelector } from "@/components/ModelSelector";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import type { HistoryEntry } from "@/components/HistoryDrawer";
import { CompareView } from "@/components/CompareView";
import styles from "./page.module.css";

// ── Types ──

type Purpose =
  | "blog-hero"
  | "social-og"
  | "ad-creative"
  | "case-study"
  | "icon"
  | "infographic";

interface BrandOption {
  readonly id: string;
  readonly connected: boolean;
}

interface StudioEntry {
  readonly id: string;
  readonly topic: string;
  readonly purpose: Purpose;
  readonly brand: string;
  readonly model: ModelId;
  readonly imageDataUrl: string;
  readonly imageBase64: string;
  readonly thumbnailDataUrl: string; // small JPEG stored in localStorage; reconstructed on reload
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly processingTimeMs: number;
  readonly brandContextUsed: boolean;
  readonly timestamp: number;
}

// ── Constants ──

const HISTORY_KEY = "orbit-studio-history";
const MAX_HISTORY = 20;

const PURPOSES: readonly { readonly id: Purpose; readonly label: string }[] = [
  { id: "blog-hero", label: "Blog Hero" },
  { id: "social-og", label: "Social OG" },
  { id: "ad-creative", label: "Ad Creative" },
  { id: "case-study", label: "Case Study" },
  { id: "icon", label: "Icon" },
  { id: "infographic", label: "Infographic" },
];

const ASPECT_RATIOS = ["1:1", "4:5", "3:2", "16:9", "9:16"] as const;

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  replicate: "#8b5cf6",
  xai: "#3b82f6",
};

// ── Thumbnail helper ──

/**
 * Resize a base64 image to a small JPEG thumbnail for localStorage.
 * Falls back to the original base64 if canvas is unavailable.
 */
async function createThumbnail(base64: string, mimeType: string, maxPx = 400): Promise<string> {
  if (!base64) return "";
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(base64); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } catch {
        resolve(base64);
      }
    };
    img.onerror = () => resolve(base64);
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ── LocalStorage helpers ──

function loadHistory(): StudioEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as Partial<StudioEntry>[];
    return raw.map((e, i) => {
      // Reconstruct imageDataUrl from imageBase64 if not stored (avoids double-storage quota hit)
      const imageDataUrl =
        e.imageDataUrl ||
        (e.imageBase64 ? `data:${e.mimeType ?? "image/png"};base64,${e.imageBase64}` : "");
      return {
        ...e,
        id: e.id ?? `legacy-${i}`,
        imageDataUrl,
        imageBase64: e.imageBase64 ?? "",
        thumbnailDataUrl: e.thumbnailDataUrl ?? "",
        topic: e.topic ?? "",
        purpose: (e.purpose ?? "blog-hero") as Purpose,
        brand: e.brand ?? "",
        model: (e.model ?? "gpt-image-1") as ModelId,
        mimeType: e.mimeType ?? "image/png",
        dimensions: e.dimensions ?? { width: 1024, height: 1024 },
        processingTimeMs: e.processingTimeMs ?? 0,
        brandContextUsed: e.brandContextUsed ?? false,
        timestamp: e.timestamp ?? 0,
      };
    });
  } catch {
    return [];
  }
}

function persistHistory(entries: StudioEntry[]): void {
  // Save a compact representation:
  // - Blob-mode (imageDataUrl starts with "http"): store the Blob URL
  // - Base64-mode: store the thumbnail data URL (JPEG, ~30-80 KB) instead of the
  //   full base64 (~1-3 MB) to avoid QuotaExceededError.
  // - Legacy entries (no thumbnailDataUrl): fall back to imageBase64 for backward compat.
  const toSave = entries.slice(0, MAX_HISTORY).map(
    ({ imageDataUrl, imageBase64, thumbnailDataUrl, ...rest }) => {
      const storedUrl = imageDataUrl.startsWith("http")
        ? imageDataUrl              // Vercel Blob URL
        : thumbnailDataUrl || undefined;  // JPEG thumbnail for base64-mode
      // Backward compat: if no thumbnail yet (old entries), keep the full base64
      const storedBase64 = !storedUrl ? imageBase64 : undefined;
      return {
        ...rest,
        ...(storedUrl ? { imageDataUrl: storedUrl } : {}),
        ...(storedBase64 ? { imageBase64: storedBase64 } : {}),
      };
    },
  );
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
  } catch {
    // Quota exceeded — keep only the most recent entries
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave.slice(0, 3)));
    } catch {
      // Storage unavailable — silently skip
    }
  }
}

// ── Convert StudioEntry → HistoryEntry for HistoryDrawer ──

function toHistoryEntry(e: StudioEntry): HistoryEntry {
  // Determine the best URL for HistoryDrawer thumbnails:
  // - In-session (imageBase64 set): HistoryDrawer uses base64 directly → no url needed
  // - Blob-mode: imageBase64 is empty, use the Blob URL
  // - After reload (thumbnailDataUrl was stored as imageDataUrl): use imageDataUrl
  const imageUrl = e.imageDataUrl.startsWith("http")
    ? e.imageDataUrl          // Blob URL
    : !e.imageBase64
    ? e.imageDataUrl || undefined  // thumbnail data URL (after reload)
    : undefined;              // in-session: base64 used directly
  return {
    id: e.id,
    images: [
      {
        base64: e.imageBase64,
        url: imageUrl,
        prompt: e.topic,
        mimeType: e.mimeType,
        dimensions: e.dimensions,
      },
    ],
    brand: e.brand,
    purpose: e.purpose,
    topic: e.topic,
    processingTimeMs: e.processingTimeMs,
    cortexDataCached: false,
    resultCached: false,
    generatedAt: e.timestamp,
    model: e.model,
  };
}

// ── Dropdown chip ──

interface DropdownChipProps {
  value: string;
  options: readonly { readonly value: string; readonly label: string }[];
  onChange: (v: string) => void;
  label: string;
  dotColor?: string;
}

function DropdownChip({
  value,
  options,
  onChange,
  label,
  dotColor,
}: DropdownChipProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.chipWrap}>
      {open && (
        <div className={styles.dropBackdrop} onClick={() => setOpen(false)} />
      )}
      <button
        type="button"
        className={styles.ctrlChip}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${label}: ${selected?.label ?? value}`}
      >
        {dotColor && (
          <span className={styles.chipDot} style={{ background: dotColor }} />
        )}
        {selected?.label ?? value}
        <span className={styles.chipCaret}>▾</span>
      </button>
      {open && (
        <div className={styles.dropMenu}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.dropItem} ${opt.value === value ? styles.dropItemActive : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandChip({
  brand,
  brands,
  onChange,
}: {
  brand: string;
  brands: BrandOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (brands.length === 0) return null;

  return (
    <div className={styles.chipWrap}>
      {open && (
        <div className={styles.dropBackdrop} onClick={() => setOpen(false)} />
      )}
      <button
        type="button"
        className={styles.ctrlChip}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Brand: ${brand || "None"}`}
      >
        <span
          className={styles.chipDot}
          style={{ background: brand ? "#8b5cf6" : "#3a3a5a" }}
        />
        {brand || "Brand"}
        <span className={styles.chipCaret}>▾</span>
      </button>
      {open && (
        <div className={styles.dropMenu}>
          <button
            type="button"
            className={`${styles.dropItem} ${!brand ? styles.dropItemActive : ""}`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            None
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`${styles.dropItem} ${b.id === brand ? styles.dropItemActive : ""}`}
              onClick={() => {
                onChange(b.id);
                setOpen(false);
              }}
            >
              {b.id}
              {b.connected && <span className={styles.connectedDot} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ──

export default function StudioPage() {
  const [prompt, setPrompt] = useState("");
  const [brand, setBrand] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("blog-hero");
  const [model, setModel] = useState<ModelId>("gpt-image-1");
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [count, setCount] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StudioEntry[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);

  const [modelOpen, setModelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const { status: providerStatus } = useProviderStatus();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Fetch brands on mount
  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await apiFetch("/api/admin/brands");
        if (res.ok) {
          const data = await res.json();
          if (
            data.success &&
            Array.isArray(data.connections) &&
            data.connections.length > 0
          ) {
            const connected = data.connections
              .filter((c: { connected: boolean }) => c.connected)
              .map((c: { brandId: string }) => ({
                id: c.brandId,
                connected: true,
              }));
            if (connected.length > 0) {
              setBrands(connected);
              return;
            }
          }
        }
        const r2 = await apiFetch("/api/brands");
        if (r2.ok) {
          const d = await r2.json();
          if (Array.isArray(d.brands)) {
            setBrands(
              d.brands
                .filter((b: { active: boolean }) => b.active)
                .map((b: { id: string }) => ({ id: b.id, connected: false }))
            );
          }
        }
      } catch {
        // brands are optional
      }
    }
    fetchBrands();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (prompt.trim().length < 3 || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        topic: prompt.trim(),
        purpose,
      };
      if (brand) body.brand = brand;
      body.model = model;

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

      const img = json.images?.[0];
      if (!img) {
        setError("No image returned");
        return;
      }

      const imageBase64: string = img.base64 ?? "";
      const imageDataUrl: string =
        img.url ??
        (imageBase64 ? `data:${img.mimeType};base64,${imageBase64}` : "");

      // Create a small JPEG thumbnail (~30-80 KB) to persist in localStorage
      // instead of the full base64 image (~1-3 MB) which hits the quota limit.
      const thumbnailDataUrl = await createThumbnail(imageBase64, img.mimeType ?? "image/png");

      const entry: StudioEntry = {
        id: Date.now().toString(),
        topic: prompt.trim(),
        purpose,
        brand: brand || json.brand || "",
        model,
        imageDataUrl,
        imageBase64,
        thumbnailDataUrl,
        mimeType: img.mimeType ?? "image/png",
        dimensions: img.dimensions ?? { width: 1024, height: 1024 },
        processingTimeMs: json.metadata?.processingTimeMs ?? 0,
        brandContextUsed: json.metadata?.brandContextUsed ?? false,
        timestamp: Date.now(),
      };

      const updated = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      persistHistory(updated);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, purpose, brand, model, isGenerating, history]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
      if (e.key === "Escape") {
        setModelOpen(false);
        setHistoryOpen(false);
        setCompareOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleGenerate]);

  // Auto-dismiss error after 5s
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const handleRestore = useCallback((entry: StudioEntry) => {
    setPrompt(entry.topic);
    setBrand(entry.brand || "");
    setPurpose(entry.purpose);
    setModel(entry.model);
    textareaRef.current?.focus();
  }, []);

  const handleRestoreFromDrawer = useCallback(
    (entry: HistoryEntry) => {
      const studioEntry = history.find((e) => e.id === entry.id);
      if (studioEntry) {
        handleRestore(studioEntry);
      } else {
        setPrompt(entry.topic);
        setBrand(entry.brand || "");
        setPurpose(entry.purpose as Purpose);
        if (entry.model) setModel(entry.model as ModelId);
      }
      setHistoryOpen(false);
    },
    [history, handleRestore]
  );

  const handleDownload = useCallback(() => {
    const entry = history[0];
    if (!entry) return;
    const a = document.createElement("a");
    a.href = entry.imageDataUrl;
    const slug = entry.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30);
    a.download = `orbit-${entry.brand || "generic"}-${entry.purpose}-${slug}.png`;
    a.click();
  }, [history]);

  const handleShare = useCallback(async () => {
    const entry = history[0];
    if (!entry) return;
    const url = entry.imageDataUrl.startsWith("http")
      ? entry.imageDataUrl
      : window.location.href;
    if (
      typeof navigator.share === "function" &&
      entry.imageDataUrl.startsWith("http")
    ) {
      try {
        await navigator.share({ title: "Orbit Image", url });
        return;
      } catch {
        /* ignore */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }, [history]);

  const latest = history[0];
  const showFeatured = isGenerating || !!latest;
  const selectedModelEntry = MODEL_CATALOG[model];
  const providerColor = selectedModelEntry
    ? (PROVIDER_COLORS[selectedModelEntry.provider] ?? "#8b5cf6")
    : "#8b5cf6";

  const providerLabel =
    selectedModelEntry?.provider === "openai"
      ? "OpenAI"
      : selectedModelEntry?.provider === "replicate"
        ? "Replicate"
        : "xAI";

  const historyEntries = history.map(toHistoryEntry);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBox}>O</span>
          <span className={styles.logoText}>Orbit</span>
        </Link>
        <div className={styles.headerSep} />
        <span className={styles.headerTitle}>Studio</span>
        <div className={styles.headerSpacer} />
        {providerStatus && (
          <div className={styles.statusChip}>
            <span className={styles.statusDot} />
            {providerLabel}
          </div>
        )}
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => setHistoryOpen(true)}
          aria-label="Open generation history"
        >
          History
        </button>
        <Link href="/" className={styles.headerBtn}>
          ← Dashboard
        </Link>
      </header>

      {/* ── Gallery ── */}
      <main className={styles.gallery}>
        {/* Empty state overlay — only when nothing has been generated */}
        {!showFeatured && (
          <div className={styles.emptyOverlay}>
            <p className={styles.emptyText}>Generate your first image</p>
            <span className={styles.emptyArrow}>↓</span>
          </div>
        )}

        {/* Featured cell — latest result or loading shimmer */}
        {showFeatured && (
          <div
            className={`${styles.cell} ${styles.cellFeatured} ${isGenerating ? styles.cellLoading : ""}`}
          >
            {isGenerating && (
              <div className={styles.loadingOverlay}>
                <div className={styles.loadingRing} />
                <span className={styles.loadingText}>Generating…</span>
              </div>
            )}
            {!isGenerating && latest && (
              <>
                <img
                  className={styles.featImage}
                  src={latest.imageDataUrl || undefined}
                  alt={latest.topic}
                />
                <div className={styles.featTop}>
                  <div className={styles.featTopic}>{latest.topic}</div>
                  <div className={styles.featActions}>
                    <button
                      type="button"
                      className={styles.featAction}
                      onClick={handleDownload}
                    >
                      ⬇ Save
                    </button>
                    <button
                      type="button"
                      className={`${styles.featAction} ${styles.featActionRegen}`}
                      onClick={handleGenerate}
                    >
                      ⟳ Regen
                    </button>
                    <button
                      type="button"
                      className={styles.featAction}
                      onClick={handleShare}
                    >
                      ↗ Share
                    </button>
                    {latest.imageBase64 && (
                      <button
                        type="button"
                        className={styles.featAction}
                        onClick={() => setCompareOpen(true)}
                      >
                        ⊞ Compare
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.featBadge}>
                  ✦
                  {latest.processingTimeMs > 0
                    ? ` ${(latest.processingTimeMs / 1000).toFixed(1)}s · `
                    : " "}
                  {MODEL_CATALOG[latest.model]?.displayName ?? latest.model}
                  {latest.brandContextUsed && (
                    <span className={styles.featBrandDot} />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* History cells */}
        {history.slice(showFeatured ? 1 : 0).map((entry, idx) => (
          <div
            key={entry.id ?? `h-${idx}`}
            className={styles.cell}
            onClick={() => handleRestore(entry)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleRestore(entry)}
            aria-label={`Restore: ${entry.topic}`}
          >
            {entry.imageDataUrl && (
              <img
                className={styles.cellImage}
                src={entry.imageDataUrl}
                alt={entry.topic}
              />
            )}
            <div className={styles.cellOverlay}>
              <div className={styles.cellLabel}>
                <span className={styles.cellTopic}>{entry.topic}</span>
                <span className={styles.cellMeta}>
                  {entry.purpose}
                  {entry.brand ? ` · ${entry.brand}` : ""}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Placeholder cells — fill remaining grid slots after real content */}
        {Array.from({ length: 20 }, (_, i) => (
          <div key={`ph-${i}`} className={`${styles.cell} ${styles.cellEmpty}`} />
        ))}

        {/* Error toast */}
        {error && <div className={styles.errorBanner}>{error}</div>}
      </main>

      {/* ── Bottom bar ── */}
      <div className={styles.bottomBar}>
        <div className={styles.barInner}>
          {/* Row 1: prompt textarea */}
          <div className={styles.barRow1}>
            <textarea
              ref={textareaRef}
              className={styles.barTextarea}
              placeholder="Describe your image — topic, mood, style…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Row 2: brand / purpose / model / aspect / count / generate */}
          <div className={styles.barRow2}>
            <BrandChip brand={brand} brands={brands} onChange={setBrand} />

            <DropdownChip
              value={purpose}
              options={PURPOSES.map((p) => ({
                value: p.id,
                label: p.label,
              }))}
              onChange={(v) => setPurpose(v as Purpose)}
              label="Purpose"
            />

            <div className={styles.ctrlSep} />

            {/* Model chip — opens ModelSelector popover */}
            <div className={styles.chipWrap}>
              <button
                type="button"
                className={styles.ctrlChip}
                onClick={() => setModelOpen(true)}
                aria-label={`Model: ${selectedModelEntry?.displayName ?? model}`}
              >
                <span
                  className={styles.chipDot}
                  style={{ background: providerColor }}
                />
                {selectedModelEntry?.displayName ?? model}
                <span className={styles.chipCaret}>▾</span>
              </button>
            </div>

            <DropdownChip
              value={aspectRatio}
              options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
              onChange={setAspectRatio}
              label="Aspect ratio"
            />

            {/* Count control */}
            <div className={styles.countCtrl}>
              <button
                type="button"
                className={styles.countBtn}
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                aria-label="Decrease count"
              >
                −
              </button>
              <span className={styles.countVal}>{count}</span>
              <button
                type="button"
                className={styles.countBtn}
                onClick={() => setCount((c) => Math.min(4, c + 1))}
                aria-label="Increase count"
              >
                +
              </button>
            </div>

            <div className={styles.barSpacer} />
            <span className={styles.kbdHint}>⌘↵</span>

            <button
              type="button"
              className={styles.genBtn}
              onClick={handleGenerate}
              disabled={prompt.trim().length < 3 || isGenerating}
            >
              Generate ✦
              <span className={styles.genCount}>{count}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Model selector popover ── */}
      {modelOpen && (
        <div
          className={styles.modelPopoverBackdrop}
          onClick={() => setModelOpen(false)}
        >
          <div
            className={styles.modelPopover}
            onClick={(e) => e.stopPropagation()}
          >
            <ModelSelector
              value={model}
              onChange={(m) => {
                setModel(m);
                setModelOpen(false);
              }}
              purpose={purpose}
              quality="standard"
              providerStatus={providerStatus}
            />
          </div>
        </div>
      )}

      {/* ── History drawer ── */}
      <HistoryDrawer
        isOpen={historyOpen}
        entries={historyEntries}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreFromDrawer}
      />

      {/* ── Compare view modal ── */}
      {compareOpen && latest?.imageBase64 && (
        <div className={styles.compareOverlay} onClick={() => setCompareOpen(false)}>
          <div className={styles.compareModal} onClick={(e) => e.stopPropagation()}>
            <CompareView
              originalImage={{
                base64: latest.imageBase64,
                prompt: latest.topic,
                mimeType: latest.mimeType,
                dimensions: latest.dimensions,
              }}
              originalModel={latest.model}
              originalTimeMs={latest.processingTimeMs}
              topic={latest.topic}
              purpose={latest.purpose}
              brand={latest.brand}
              quality="standard"
              providerStatus={providerStatus}
              onClose={() => setCompareOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
