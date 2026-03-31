"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
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

const PURPOSES: readonly { readonly id: Purpose; readonly label: string }[] = [
  { id: "blog-hero", label: "Blog Hero" },
  { id: "social-og", label: "Social" },
  { id: "ad-creative", label: "Ad" },
  { id: "case-study", label: "Case Study" },
  { id: "icon", label: "Icon" },
  { id: "infographic", label: "Infographic" },
];

export default function StudioPage() {
  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("blog-hero");
  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = topic.trim().length >= 3;

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), purpose }),
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
  }, [topic, purpose, canSubmit]);

  const handleDownload = useCallback(() => {
    const img = generated?.images[0];
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.url ?? `data:${img.mimeType};base64,${img.base64}`;
    a.download = "orbit-image.png";
    a.click();
  }, [generated]);

  const handleCopyUrl = useCallback(async () => {
    const url = generated?.images[0]?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard blocked
    }
  }, [generated]);

  const imageUrl = generated?.images[0]?.url
    ?? (generated?.images[0]?.base64
      ? `data:${generated.images[0].mimeType};base64,${generated.images[0].base64}`
      : null);

  const hasResult = generated && imageUrl && !loading;

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

      {/* Main Content */}
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

            {/* Purpose row */}
            <div className={styles.purposeRow}>
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.purposeChip} ${purpose === p.id ? styles.purposeChipActive : ""}`}
                  onClick={() => setPurpose(p.id)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>

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

            {/* Error */}
            {error && (
              <div className={styles.error}>{error}</div>
            )}

            <p className={styles.hint}>3 free generations per day · Brand context applied automatically</p>
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

            {/* Meta bar */}
            <div className={styles.metaBar}>
              <span className={styles.metaBrand}>
                {generated.metadata.brandContextUsed
                  ? <><span className={styles.metaDot} />{generated.brand} brand</>
                  : "Generic (no brand)"}
              </span>
              <span className={styles.metaTime}>
                {(generated.metadata.processingTimeMs / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleDownload} type="button">
                Download
              </button>
              {generated.images[0]?.url && (
                <button className={styles.actionBtn} onClick={handleCopyUrl} type="button">
                  Copy URL
                </button>
              )}
              <button
                className={styles.actionBtnPrimary}
                onClick={() => { setGenerated(null); setError(null); }}
                type="button"
              >
                Generate Another
              </button>
            </div>

            {/* CTA */}
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
