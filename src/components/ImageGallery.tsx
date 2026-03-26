"use client";

import { useState } from "react";
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
}

export function ImageGallery({
  images,
  brand,
  processingTimeMs,
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);

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
        </div>
        <button
          className={styles.promptToggle}
          onClick={() => setShowPrompt(!showPrompt)}
        >
          {showPrompt ? "Hide" : "Show"} Prompt
        </button>
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

      {/* Prompt display */}
      {showPrompt && (
        <div className={styles.promptBox}>
          <p className={styles.promptLabel}>Generated Prompt</p>
          <p className={styles.promptText}>{selected.prompt}</p>
        </div>
      )}

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
