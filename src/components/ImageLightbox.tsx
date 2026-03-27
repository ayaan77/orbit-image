"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./ImageLightbox.module.css";

interface LightboxImage {
  readonly base64: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface ImageLightboxProps {
  readonly images: readonly LightboxImage[];
  readonly initialIndex: number;
  readonly brand: string;
  readonly onClose: () => void;
  readonly onDownload: (img: LightboxImage, index: number) => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  brand,
  onClose,
  onDownload,
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const img = images[index];
  const hasMultiple = images.length > 1;

  const goNext = useCallback(() => {
    if (hasMultiple) setIndex((i) => (i + 1) % images.length);
  }, [hasMultiple, images.length]);

  const goPrev = useCallback(() => {
    if (hasMultiple) setIndex((i) => (i - 1 + images.length) % images.length);
  }, [hasMultiple, images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!img) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-label="Image lightbox">
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close lightbox">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button className={`${styles.navBtn} ${styles.navPrev}`} onClick={goPrev} aria-label="Previous image">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className={`${styles.navBtn} ${styles.navNext}`} onClick={goNext} aria-label="Next image">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Image */}
        <img
          className={`${styles.image} ${zoomed ? styles.imageZoomed : ""}`}
          src={`data:${img.mimeType};base64,${img.base64}`}
          alt={`Generated image for ${brand}`}
          onClick={() => setZoomed(!zoomed)}
        />

        {/* Bottom bar */}
        <div className={styles.bottomBar}>
          <div className={styles.promptText}>{img.prompt}</div>
          <div className={styles.bottomActions}>
            <span className={styles.counter}>
              {index + 1} / {images.length}
            </span>
            <span className={styles.dimLabel}>
              {img.dimensions.width} x {img.dimensions.height}
            </span>
            <button
              className={styles.downloadBtn}
              onClick={() => onDownload(img, index)}
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M9 3V12M9 12L5 8M9 12L13 8M3 15H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
