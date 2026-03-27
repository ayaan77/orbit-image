"use client";

import { useState, useMemo } from "react";
import type { GenerateRequest } from "@/types/api";
import { DEFAULT_MODEL, type ModelId } from "@/lib/providers/models";
import { BrandPicker } from "@/components/BrandPicker";
import { BrandPreview } from "@/components/BrandPreview";
import { ModelSelector } from "@/components/ModelSelector";
import { GenerationSummary } from "@/components/GenerationSummary";
import type { ProviderStatus } from "@/lib/client/useProviderStatus";
import styles from "./GeneratorForm.module.css";

const PURPOSES = [
  { value: "blog-hero", label: "Blog Hero", icon: "article", description: "1536×1024 · editorial" },
  { value: "social-og", label: "Social / OG", icon: "share", description: "1536×1024 · feed-optimized" },
  { value: "ad-creative", label: "Ad Creative", icon: "campaign", description: "1024×1024 · conversion" },
  { value: "case-study", label: "Case Study", icon: "analytics", description: "1536×1024 · data-viz" },
  { value: "icon", label: "Icon", icon: "apps", description: "1024×1024 · symbolic" },
  { value: "infographic", label: "Infographic", icon: "bar_chart", description: "1024×1536 · tall" },
] as const;

const STYLES = [
  { value: "photographic", label: "Photographic" },
  { value: "illustration", label: "Illustration" },
  { value: "3d-render", label: "3D Render" },
  { value: "flat-design", label: "Flat Design" },
  { value: "abstract", label: "Abstract" },
  { value: "minimalist", label: "Minimalist" },
] as const;

const INDUSTRY_PRESETS = [
  "SaaS", "Healthcare", "Fintech", "E-commerce", "Professional Services",
] as const;

const DIMENSION_PRESETS = [
  { label: "1:1 (1024)", width: 1024, height: 1024 },
  { label: "16:9 (1536×864)", width: 1536, height: 864 },
  { label: "OG (1200×630)", width: 1200, height: 630 },
  { label: "Portrait (1024×1536)", width: 1024, height: 1536 },
] as const;

interface GeneratorFormProps {
  readonly onSubmit: (data: GenerateRequest) => void;
  readonly isLoading: boolean;
  readonly providerStatus: ProviderStatus | null;
}

export function GeneratorForm({ onSubmit, isLoading, providerStatus }: GeneratorFormProps) {
  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState<GenerateRequest["purpose"]>("blog-hero");
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [style, setStyle] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [quality, setQuality] = useState<"standard" | "hd">("hd");
  const [count, setCount] = useState(1);
  const [showFineTune, setShowFineTune] = useState(false);

  // Fine-tune fields
  const [audience, setAudience] = useState("");
  const [persona, setPersona] = useState("");
  const [industry, setIndustry] = useState("");
  const [customDimensions, setCustomDimensions] = useState(false);
  const [dimWidth, setDimWidth] = useState(1024);
  const [dimHeight, setDimHeight] = useState(1024);

  const fineTuneCount = useMemo(() =>
    [audience, persona, industry, brand].filter(Boolean).length
    + (customDimensions ? 1 : 0),
    [audience, persona, industry, brand, customDimensions]
  );

  // Section 2 auto-expands when topic has content
  const showHowSection = topic.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;

    const request: GenerateRequest = {
      topic: topic.trim(),
      purpose,
      model,
      count,
      quality,
      output_format: "base64",
      ...(style ? { style: style as GenerateRequest["style"] } : {}),
      ...(brand ? { brand } : {}),
      ...(audience.trim() ? { audience: audience.trim() } : {}),
      ...(persona.trim() ? { persona: persona.trim() } : {}),
      ...(industry.trim() ? { industry: industry.trim() } : {}),
      ...(customDimensions ? { dimensions: { width: dimWidth, height: dimHeight } } : {}),
    };
    onSubmit(request);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* ═══ Section 1: "What" — Always visible ═══ */}
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
              <span className={styles.purposeDesc}>{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Section 2: "How" — Auto-reveals when topic filled ═══ */}
      {showHowSection && (
        <div className={styles.howSection}>
          <ModelSelector
            value={model}
            onChange={setModel}
            purpose={purpose}
            quality={quality}
            providerStatus={providerStatus}
          />

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

          <GenerationSummary
            purpose={purpose}
            model={model}
            quality={quality}
            count={count}
            brand={brand}
            style={style}
          />
        </div>
      )}

      {/* ═══ Section 3: "Fine-tune" — Collapsed by default ═══ */}
      <button
        type="button"
        className={styles.advancedToggle}
        onClick={() => setShowFineTune(!showFineTune)}
      >
        <span>
          Fine-tune
          {fineTuneCount > 0 && (
            <span className={styles.advancedBadge}>{fineTuneCount}</span>
          )}
        </span>
        <svg
          className={`${styles.chevron} ${showFineTune ? styles.chevronOpen : ""}`}
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

      {showFineTune && (
        <div className={styles.advancedSection}>
          {/* Brand Selection */}
          <div className={styles.field}>
            <label className={styles.label}>Brand</label>
            <BrandPicker value={brand} onChange={setBrand} />
            <BrandPreview brandId={brand} />
          </div>

          {/* Audience */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="audience">
              Target Audience
            </label>
            <input
              id="audience"
              type="text"
              className={styles.input}
              placeholder="e.g. B2B marketing directors"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              maxLength={200}
            />
            <span className={styles.hint}>
              Leave blank to use brand defaults.
            </span>
          </div>

          {/* Persona */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="persona">
              Persona
            </label>
            <input
              id="persona"
              type="text"
              className={styles.input}
              placeholder="e.g. The Growth Hacker"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Industry */}
          <div className={styles.field}>
            <label className={styles.label}>Industry</label>
            <div className={styles.presetChips}>
              {INDUSTRY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.presetChip} ${
                    industry === preset ? styles.presetChipActive : ""
                  }`}
                  onClick={() => setIndustry(industry === preset ? "" : preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="industry"
              type="text"
              className={styles.input}
              placeholder="or type a custom industry..."
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Custom Dimensions */}
          <div className={styles.field}>
            <div className={styles.dimensionsHeader}>
              <label className={styles.label}>Custom Dimensions</label>
              <button
                type="button"
                className={`${styles.dimToggleBtn} ${customDimensions ? styles.dimToggleBtnOn : ""}`}
                onClick={() => setCustomDimensions(!customDimensions)}
              >
                {customDimensions ? "On" : "Off"}
              </button>
            </div>
            {customDimensions && (
              <div className={styles.dimensionsContent}>
                <div className={styles.dimPresets}>
                  {DIMENSION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className={`${styles.presetChip} ${
                        dimWidth === preset.width && dimHeight === preset.height
                          ? styles.presetChipActive
                          : ""
                      }`}
                      onClick={() => {
                        setDimWidth(preset.width);
                        setDimHeight(preset.height);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className={styles.dimInputRow}>
                  <div className={styles.dimInputGroup}>
                    <label className={styles.dimLabel} htmlFor="dim-width">W</label>
                    <input
                      id="dim-width"
                      type="number"
                      className={`${styles.input} ${styles.dimInput}`}
                      value={dimWidth}
                      onChange={(e) => setDimWidth(Math.min(4096, Math.max(256, Number(e.target.value))))}
                      min={256}
                      max={4096}
                      step={64}
                    />
                  </div>
                  <span className={styles.dimSep}>&times;</span>
                  <div className={styles.dimInputGroup}>
                    <label className={styles.dimLabel} htmlFor="dim-height">H</label>
                    <input
                      id="dim-height"
                      type="number"
                      className={`${styles.input} ${styles.dimInput}`}
                      value={dimHeight}
                      onChange={(e) => setDimHeight(Math.min(4096, Math.max(256, Number(e.target.value))))}
                      min={256}
                      max={4096}
                      step={64}
                    />
                  </div>
                </div>
                <span className={styles.hint}>256–4096 px per side.</span>
              </div>
            )}
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
