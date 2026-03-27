"use client";

import { useState, useCallback } from "react";
import styles from "./ImageGallery.module.css";

interface GeneratedImage {
  readonly base64: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface ImageGalleryProps {
  readonly images: readonly GeneratedImage[];
  readonly brand: string;
  readonly processingTimeMs: number;
  readonly cortexDataCached: boolean;
  readonly resultCached: boolean;
}

export function ImageGallery({
  images,
  brand,
  processingTimeMs,
  cortexDataCached,
  resultCached,
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  }, []);

  const selected = images[selectedIndex];
  if (!selected) return null;

  const handleDownload = (img: GeneratedImage, index: number) => {
    const ext = img.mimeType.split("/")[1] ?? "png";
    const link = document.createElement("a");
    link.href = `data:${img.mimeType};base64,${img.base64}`;
    link.download = `orbit-${brand}-${index + 1}.${ext}`;
    link.click();
  };

  return (
    <div className={styles.gallery}>
      {/* Meta bar */}
      <div className={styles.metaBar}>
        <div className={styles.metaLeft}>
          <span className={styles.badge}>{brand}</span>
          <span className={styles.metaStat}>
            {images.length} image{images.length > 1 ? "s" : ""}
          </span>
          <span className={styles.metaDot} />
          <span className={styles.metaStat}>
            {(processingTimeMs / 1000).toFixed(1)}s
          </span>
          {cortexDataCached && (
            <span className={styles.cacheBadge}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              cached
            </span>
          )}
          {resultCached && (
            <span className={styles.resultCacheBadge}>result cached</span>
          )}
        </div>
      </div>

      {/* Main image */}
      <div className={styles.mainImageWrap}>
        <img
          className={styles.mainImage}
          src={`data:${selected.mimeType};base64,${selected.base64}`}
          alt={`Generated image for ${brand}`}
          width={selected.dimensions.width}
          height={selected.dimensions.height}
        />
        <div className={styles.imageOverlay}>
          <span className={styles.dimensionsBadge}>
            {selected.dimensions.width} x {selected.dimensions.height}
          </span>
          <button
            className={styles.downloadBtn}
            onClick={() => handleDownload(selected, selectedIndex)}
            aria-label="Download image"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 3V12M9 12L5 8M9 12L13 8M3 15H15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Prompt display — always visible */}
      <div className={styles.promptBox}>
        <div className={styles.promptHeader}>
          <p className={styles.promptLabel}>Generated Prompt</p>
          <div className={styles.promptActions}>
            {selected.prompt.length > 120 && (
              <button
                className={styles.promptExpandBtn}
                onClick={() => setPromptExpanded(!promptExpanded)}
              >
                {promptExpanded ? "Collapse" : "Expand"}
              </button>
            )}
            <button
              className={styles.promptCopyBtn}
              onClick={() => handleCopyPrompt(selected.prompt)}
              aria-label="Copy prompt"
            >
              {promptCopied ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
              {promptCopied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <p className={`${styles.promptText} ${promptExpanded ? styles.promptTextExpanded : ""}`}>
          {selected.prompt}
        </p>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className={styles.thumbStrip}>
          {images.map((img, i) => (
            <button
              key={i}
              className={`${styles.thumb} ${
                i === selectedIndex ? styles.thumbActive : ""
              }`}
              onClick={() => setSelectedIndex(i)}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={`data:${img.mimeType};base64,${img.base64}`}
                alt={`Thumbnail ${i + 1}`}
                className={styles.thumbImg}
              />
            </button>
          ))}
        </div>
      )}

      {/* Download all */}
      {images.length > 1 && (
        <div className={styles.actions}>
          <button
            className={styles.downloadAllBtn}
            onClick={() => images.forEach((img, i) => handleDownload(img, i))}
          >
            Download All ({images.length})
          </button>
        </div>
      )}
    </div>
  );
}
