"use client";

import { useState } from "react";
import type { GenerateRequest } from "@/types/api";
import styles from "./GeneratorForm.module.css";

const PURPOSES = [
  { value: "blog-hero", label: "Blog Hero", icon: "article" },
  { value: "social-og", label: "Social / OG", icon: "share" },
  { value: "ad-creative", label: "Ad Creative", icon: "campaign" },
  { value: "case-study", label: "Case Study", icon: "analytics" },
  { value: "icon", label: "Icon", icon: "apps" },
  { value: "infographic", label: "Infographic", icon: "bar_chart" },
] as const;

const STYLES = [
  { value: "photographic", label: "Photographic" },
  { value: "illustration", label: "Illustration" },
  { value: "3d-render", label: "3D Render" },
  { value: "flat-design", label: "Flat Design" },
  { value: "abstract", label: "Abstract" },
  { value: "minimalist", label: "Minimalist" },
] as const;

interface GeneratorFormProps {
  readonly onSubmit: (data: GenerateRequest) => void;
  readonly isLoading: boolean;
}

export function GeneratorForm({ onSubmit, isLoading }: GeneratorFormProps) {
  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState<GenerateRequest["purpose"]>("blog-hero");
  const [style, setStyle] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [quality, setQuality] = useState<"standard" | "hd">("hd");
  const [count, setCount] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;

    const request: GenerateRequest = {
      topic: topic.trim(),
      purpose,
      count,
      quality,
      ...(style ? { style: style as GenerateRequest["style"] } : {}),
      ...(brand ? { brand } : {}),
    };
    onSubmit(request);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* Topic Input */}
      <div className={styles.topicSection}>
        <label className={styles.label} htmlFor="topic">
          What do you want to create?
        </label>
        <textarea
          id="topic"
          className={styles.topicInput}
          placeholder="Describe your image... e.g. 'A futuristic dashboard showing marketing analytics with glowing data visualizations'"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          maxLength={500}
          required
        />
        <span className={styles.charCount}>
          {topic.length}/500
        </span>
      </div>

      {/* Purpose Selection */}
      <div className={styles.section}>
        <label className={styles.label}>Purpose</label>
        <div className={styles.purposeGrid}>
          {PURPOSES.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`${styles.purposeCard} ${
                purpose === p.value ? styles.purposeCardActive : ""
              }`}
              onClick={() => setPurpose(p.value)}
            >
              <span className={styles.purposeIcon}>{getPurposeEmoji(p.value)}</span>
              <span className={styles.purposeLabel}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style Selection */}
      <div className={styles.section}>
        <label className={styles.label}>Style</label>
        <div className={styles.styleGrid}>
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`${styles.styleChip} ${
                style === s.value ? styles.styleChipActive : ""
              }`}
              onClick={() => setStyle(style === s.value ? "" : s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count & Quality Row */}
      <div className={styles.rowGroup}>
        <div className={styles.fieldSmall}>
          <label className={styles.label} htmlFor="count">
            Count
          </label>
          <div className={styles.counterControl}>
            <button
              type="button"
              className={styles.counterBtn}
              onClick={() => setCount(Math.max(1, count - 1))}
              disabled={count <= 1}
              aria-label="Decrease count"
            >
              -
            </button>
            <span className={styles.counterValue}>{count}</span>
            <button
              type="button"
              className={styles.counterBtn}
              onClick={() => setCount(Math.min(4, count + 1))}
              disabled={count >= 4}
              aria-label="Increase count"
            >
              +
            </button>
          </div>
        </div>
        <div className={styles.fieldSmall}>
          <label className={styles.label}>Quality</label>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${
                quality === "standard" ? styles.toggleBtnActive : ""
              }`}
              onClick={() => setQuality("standard")}
            >
              Standard
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${
                quality === "hd" ? styles.toggleBtnActive : ""
              }`}
              onClick={() => setQuality("hd")}
            >
              HD
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Options */}
      <button
        type="button"
        className={styles.advancedToggle}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <span>Advanced Options</span>
        <svg
          className={`${styles.chevron} ${showAdvanced ? styles.chevronOpen : ""}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {showAdvanced && (
        <div className={styles.advancedSection}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="brand">
              Brand Slug
            </label>
            <input
              id="brand"
              type="text"
              className={styles.input}
              placeholder="e.g. kashmir-bloom"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              pattern="^[a-z0-9-]*$"
            />
            <span className={styles.hint}>
              Lowercase alphanumeric with hyphens. Leave empty for default brand.
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className={styles.submitBtn}
        disabled={!topic.trim() || isLoading}
      >
        {isLoading ? (
          <span className={styles.submitLoading}>
            <span className={styles.spinner} />
            Generating...
          </span>
        ) : (
          <span className={styles.submitReady}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 9.5L7.5 14L15 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0"
              />
              <path
                d="M9 2L11.09 6.26L16 6.97L12.5 10.64L13.18 16L9 13.27L4.82 16L5.5 10.64L2 6.97L6.91 6.26L9 2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Generate Image{count > 1 ? "s" : ""}
          </span>
        )}
      </button>
    </form>
  );
}

function getPurposeEmoji(purpose: string): string {
  const map: Record<string, string> = {
    "blog-hero": "\u{1F4DD}",
    "social-og": "\u{1F310}",
    "ad-creative": "\u{1F4E2}",
    "case-study": "\u{1F4CA}",
    icon: "\u{2B50}",
    infographic: "\u{1F4C8}",
  };
  return map[purpose] ?? "\u{1F5BC}";
}
