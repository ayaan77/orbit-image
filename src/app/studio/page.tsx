"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { BrandPicker } from "@/components/BrandPicker";
import styles from "./page.module.css";

type Purpose = "blog-hero" | "social-og" | "ad-creative" | "case-study" | "icon" | "infographic";
type Style = "photographic" | "illustration" | "3d-render" | "flat-design" | "abstract" | "minimalist";

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

interface SignupResult {
  readonly apiKey: string;
  readonly clientId: string;
  readonly username?: string;
  readonly limits: { readonly rateLimit: number; readonly monthlyBudgetUsd: number };
}

const PURPOSES: readonly { readonly id: Purpose; readonly label: string; readonly icon: string }[] = [
  { id: "blog-hero", label: "Blog Hero", icon: "pencil" },
  { id: "social-og", label: "Social Media", icon: "share" },
  { id: "ad-creative", label: "Ad Creative", icon: "megaphone" },
  { id: "case-study", label: "Case Study", icon: "chart" },
  { id: "icon", label: "Icon", icon: "star" },
  { id: "infographic", label: "Infographic", icon: "bars" },
];

const STYLES: readonly { readonly id: Style; readonly label: string }[] = [
  { id: "photographic", label: "Photographic" },
  { id: "illustration", label: "Illustration" },
  { id: "3d-render", label: "3D Render" },
  { id: "flat-design", label: "Flat Design" },
  { id: "abstract", label: "Abstract" },
  { id: "minimalist", label: "Minimalist" },
];

const PURPOSE_ICONS: Record<string, React.ReactNode> = {
  pencil: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  share: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  megaphone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M21 15V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10m18 0l-6-4m6 4l-6 4M3 15l6-4m-6 4l6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chart: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bars: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="10" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="17" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [brand, setBrand] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("blog-hero");
  const [style, setStyle] = useState<Style | null>(null);

  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signupResult, setSignupResult] = useState<SignupResult | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [copied, setCopied] = useState<"key" | "url" | null>(null);

  const canSubmit = topic.trim().length >= 3;

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setGenerateLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const body: Record<string, string> = {
        topic: topic.trim(),
        purpose,
      };
      if (brand) {
        body.brand = brand;
      }
      if (style) {
        body.style = style;
      }
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
      setGenerateLoading(false);
    }
  }, [topic, purpose, brand, style, canSubmit]);

  const handleSignup = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string)?.trim();
    const companyName = (formData.get("companyName") as string)?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      setSignupLoading(false);
      return;
    }
    if (!companyName) {
      setError("Company name is required.");
      setSignupLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/studio/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companyName }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Signup failed");
        return;
      }
      setSignupResult(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSignupLoading(false);
    }
  }, []);

  const handleCopyKey = useCallback(() => {
    if (!signupResult) return;
    navigator.clipboard.writeText(signupResult.apiKey)
      .then(() => { setCopied("key"); setTimeout(() => setCopied(null), 2000); })
      .catch(() => { /* clipboard blocked */ });
  }, [signupResult]);

  const handleCopyUrl = useCallback(() => {
    const img = generated?.images[0];
    if (!img?.url) return;
    navigator.clipboard.writeText(img.url)
      .then(() => { setCopied("url"); setTimeout(() => setCopied(null), 2000); })
      .catch(() => { /* clipboard blocked */ });
  }, [generated]);

  const handleDownload = useCallback(() => {
    const img = generated?.images[0];
    if (!img) return;

    if (img.url) {
      const a = document.createElement("a");
      a.href = img.url;
      a.download = "orbit-image.png";
      a.click();
      return;
    }

    if (img.base64) {
      const a = document.createElement("a");
      a.href = `data:${img.mimeType};base64,${img.base64}`;
      a.download = "orbit-image.png";
      a.click();
    }
  }, [generated]);

  const imageUrl = generated?.images[0]?.url
    ?? (generated?.images[0]?.base64
      ? `data:${generated.images[0].mimeType};base64,${generated.images[0].base64}`
      : null);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoBox}>O</span>
            <span className={styles.logoText}>Studio</span>
          </Link>
        </div>
        <Link href="/" className={styles.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Dashboard
        </Link>
      </header>

      {/* Split layout */}
      <div className={styles.splitLayout}>
        {/* ─── Left Panel: Controls ─── */}
        <aside className={styles.leftPanel}>
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Topic</label>
            <textarea
              className={styles.topicInput}
              placeholder="Describe the image you want to generate..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className={styles.charCount}>{topic.length}/500</div>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Brand</label>
            <BrandPicker value={brand} onChange={setBrand} />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>Purpose</label>
            <div className={styles.purposeGrid}>
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.purposeChip} ${purpose === p.id ? styles.purposeChipActive : ""}`}
                  onClick={() => setPurpose(p.id)}
                  type="button"
                >
                  <span className={styles.chipIcon}>{PURPOSE_ICONS[p.icon]}</span>
                  <span className={styles.chipLabel}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel}>
              Style <span className={styles.optionalTag}>optional</span>
            </label>
            <div className={styles.styleRow}>
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.styleChip} ${style === s.id ? styles.styleChipActive : ""}`}
                  onClick={() => setStyle(style === s.id ? null : s.id)}
                  type="button"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={!canSubmit || generateLoading}
            type="button"
          >
            {generateLoading ? (
              <>
                <span className={styles.btnSpinner} />
                Generating...
              </>
            ) : (
              "Generate Image"
            )}
          </button>
          <p className={styles.rateHint}>3 free generations per day</p>
        </aside>

        {/* ─── Right Panel: Preview ─── */}
        <main className={styles.rightPanel}>
          {/* Error state */}
          {error && (
            <div className={styles.errorBanner}>
              <span className={styles.errorText}>{error}</span>
              <button
                className={styles.retryBtn}
                onClick={() => {
                  setError(null);
                  if (canSubmit) {
                    handleGenerate();
                  }
                }}
                type="button"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!generated && !generateLoading && !error && (
            <div className={styles.emptyState}>
              <svg className={styles.emptyIcon} width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className={styles.emptyText}>Your image will appear here</p>
            </div>
          )}

          {/* Loading state */}
          {generateLoading && (
            <div className={styles.loadingState}>
              <span className={styles.loadingSpinner} />
              <p className={styles.loadingText}>Generating your image...</p>
            </div>
          )}

          {/* Result state */}
          {generated && imageUrl && !generateLoading && (
            <div className={styles.resultArea}>
              <div className={styles.imageWrap}>
                <img
                  className={styles.generatedImg}
                  src={imageUrl}
                  alt="AI-generated brand image"
                  width={generated.images[0].dimensions.width}
                  height={generated.images[0].dimensions.height}
                />
              </div>

              {/* Brand context bar */}
              <div className={styles.contextBar}>
                <span className={styles.contextLabel}>
                  Generated with <strong>{generated.brand}</strong> brand context
                </span>
                <span className={styles.contextTime}>
                  {(generated.metadata.processingTimeMs / 1000).toFixed(1)}s
                </span>
              </div>

              {!generated.metadata.brandContextUsed && (
                <div className={styles.warningBanner}>
                  Brand context unavailable — generic prompt used
                </div>
              )}

              {/* Action buttons */}
              <div className={styles.imageActions}>
                <button className={styles.actionBtn} onClick={handleDownload} type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download
                </button>
                {generated.images[0]?.url && (
                  <button className={styles.actionBtn} onClick={handleCopyUrl} type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    {copied === "url" ? "Copied!" : "Copy URL"}
                  </button>
                )}
              </div>

              {/* Get API Access CTA */}
              <div className={styles.ctaSection}>
                <h3 className={styles.ctaTitle}>Want unlimited access?</h3>
                {signupResult ? (
                  <div className={styles.signupSuccess}>
                    <div className={styles.successBanner}>
                      {signupResult.username
                        ? `Account created! You're signed in as ${signupResult.username}`
                        : "Key created successfully"}
                    </div>
                    <div className={styles.keyBlock}>
                      <div className={styles.keyLabel}>Your API Key</div>
                      <code className={styles.keyValue}>{signupResult.apiKey}</code>
                      <button className={styles.copyBtn} onClick={handleCopyKey} type="button">
                        {copied === "key" ? "Copied!" : "Copy to clipboard"}
                      </button>
                      <p className={styles.keyWarn}>Save this now. It won't be shown again.</p>
                    </div>
                    <Link href="/" className={styles.dashboardLink}>
                      Open Dashboard
                    </Link>
                  </div>
                ) : (
                  <form className={styles.signupForm} onSubmit={handleSignup}>
                    <div className={styles.signupFields}>
                      <input
                        className={styles.fieldInput}
                        name="email"
                        type="email"
                        placeholder="you@company.com"
                        required
                      />
                      <input
                        className={styles.fieldInput}
                        name="companyName"
                        type="text"
                        placeholder="Company name"
                        required
                      />
                      <button className={styles.signupBtn} type="submit" disabled={signupLoading}>
                        {signupLoading ? (
                          <>
                            <span className={styles.btnSpinner} />
                            Creating...
                          </>
                        ) : (
                          "Get API Access"
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
