"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Purpose = "blog-hero" | "social-og" | "ad-creative" | "case-study" | "icon" | "infographic";
type Step = "input" | "preview" | "generate" | "signup";

interface PreviewResult {
  readonly generic: { readonly positive: string };
  readonly brandAware: { readonly positive: string };
  readonly brandContext: {
    readonly used: boolean;
    readonly brand: string;
    readonly colors: ReadonlyArray<{ readonly hex: string; readonly role: string }> | null;
    readonly voiceTone: string | null;
  };
}

interface GeneratedImage {
  readonly base64: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface GenerateResult {
  readonly images: readonly GeneratedImage[];
  readonly brand: string;
  readonly metadata: { readonly processingTimeMs: number; readonly demo: boolean };
}

interface SignupResult {
  readonly apiKey: string;
  readonly clientId: string;
  readonly username?: string;
  readonly limits: { readonly rateLimit: number; readonly monthlyBudgetUsd: number };
}

const PURPOSES: readonly { readonly id: Purpose; readonly label: string; readonly icon: string; readonly desc: string }[] = [
  { id: "blog-hero", label: "Blog Hero", icon: "pencil", desc: "Header images for articles" },
  { id: "social-og", label: "Social Media", icon: "share", desc: "Feed-optimized visuals" },
  { id: "ad-creative", label: "Ad Creative", icon: "megaphone", desc: "Conversion-focused ads" },
  { id: "case-study", label: "Case Study", icon: "chart", desc: "Results & data visuals" },
  { id: "icon", label: "Icon", icon: "star", desc: "Symbolic minimal icons" },
  { id: "infographic", label: "Infographic", icon: "bars", desc: "Data-rich tall layouts" },
];

const PURPOSE_ICONS: Record<string, React.ReactNode> = {
  pencil: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  share: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" /><circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="1.5" /></svg>,
  megaphone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10m18 0l-6-4m6 4l-6 4M3 15l6-4m-6 4l6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  star: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  bars: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="10" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="17" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" /></svg>,
};

const STEP_LABELS: Record<Step, string> = {
  input: "1. Describe",
  preview: "2. Compare",
  generate: "3. Generate",
  signup: "4. Get Access",
};

export default function StudioPage() {
  const [step, setStep] = useState<Step>("input");
  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("blog-hero");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [generated, setGenerated] = useState<GenerateResult | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);

  const [signupResult, setSignupResult] = useState<SignupResult | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const canSubmit = topic.trim().length >= 3;

  const handlePreview = useCallback(async () => {
    if (!canSubmit) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), purpose }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Preview failed");
        return;
      }
      setPreview(json);
      setStep("preview");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  }, [topic, purpose, canSubmit]);

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setGenerateLoading(true);
    setError(null);
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
      setStep("generate");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerateLoading(false);
    }
  }, [topic, purpose, canSubmit]);

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

  const handleCopy = useCallback(() => {
    if (!signupResult) return;
    navigator.clipboard.writeText(signupResult.apiKey)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => { /* clipboard blocked */ });
  }, [signupResult]);

  const handleStartOver = useCallback(() => {
    setStep("input");
    setPreview(null);
    setGenerated(null);
    setError(null);
  }, []);

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="11" stroke="url(#sg)" strokeWidth="2" />
            <circle cx="14" cy="14" r="4" fill="url(#sg)" />
            <ellipse cx="14" cy="14" rx="18" ry="6" stroke="url(#sg)" strokeWidth="1.5" opacity="0.5" transform="rotate(-30 14 14)" />
            <defs><linearGradient id="sg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#6366f1" /></linearGradient></defs>
          </svg>
          <span>Orbit<strong>Image</strong></span>
        </Link>
        <div className={styles.headerRight}>
          <Link href="/" className={styles.headerLink}>Dashboard</Link>
        </div>
      </header>

      {/* Progress bar */}
      <nav className={styles.stepper}>
        {(["input", "preview", "generate", "signup"] as Step[]).map((s, i) => (
          <button
            key={s}
            className={`${styles.stepBtn} ${step === s ? styles.stepActive : ""} ${
              (["input", "preview", "generate", "signup"] as Step[]).indexOf(step) > i ? styles.stepDone : ""
            }`}
            onClick={() => {
              const order: Step[] = ["input", "preview", "generate", "signup"];
              if (order.indexOf(s) <= order.indexOf(step)) setStep(s);
            }}
            type="button"
          >
            <span className={styles.stepNum}>{i + 1}</span>
            <span className={styles.stepLabel}>{STEP_LABELS[s].split(". ")[1]}</span>
          </button>
        ))}
        <div
          className={styles.stepProgress}
          style={{ width: `${(["input", "preview", "generate", "signup"].indexOf(step) / 3) * 100}%` }}
        />
      </nav>

      {/* Error toast */}
      {error && (
        <div className={styles.errorToast}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className={styles.errorClose} type="button">x</button>
        </div>
      )}

      {/* ─── STEP 1: Input ─── */}
      {step === "input" && (
        <section className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h1 className={styles.stepTitle}>What image do you need?</h1>
            <p className={styles.stepDesc}>
              Describe your image and pick a purpose. We'll show you how your brand transforms the AI prompt.
            </p>
          </div>

          <div className={styles.card}>
            <textarea
              className={styles.topicInput}
              placeholder="e.g. A futuristic cloud migration dashboard showing real-time data flow between servers..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <div className={styles.charCount}>{topic.length}/500</div>

            <div className={styles.purposeLabel}>What's it for?</div>
            <div className={styles.purposeGrid}>
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.purposeBtn} ${purpose === p.id ? styles.purposeActive : ""}`}
                  onClick={() => setPurpose(p.id)}
                  type="button"
                >
                  <span className={styles.purposeIcon}>{PURPOSE_ICONS[p.icon]}</span>
                  <span className={styles.purposeName}>{p.label}</span>
                  <span className={styles.purposeDesc}>{p.desc}</span>
                </button>
              ))}
            </div>

            <button
              className={styles.primaryBtn}
              onClick={handlePreview}
              disabled={!canSubmit || previewLoading}
              type="button"
            >
              {previewLoading ? (
                <><span className={styles.btnSpinner} /> Analyzing...</>
              ) : (
                "See How Brand Changes the Prompt →"
              )}
            </button>
          </div>

          {/* Value prop */}
          <div className={styles.valueProp}>
            <div className={styles.valueItem}>
              <div className={styles.valueIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <strong>Your brand colors</strong>
                <p>Injected directly into AI prompts</p>
              </div>
            </div>
            <div className={styles.valueItem}>
              <div className={styles.valueIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <strong>Your brand voice</strong>
                <p>Tone and personality in every image</p>
              </div>
            </div>
            <div className={styles.valueItem}>
              <div className={styles.valueIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <strong>Purpose-optimized</strong>
                <p>Blog, social, ad — different templates</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── STEP 2: Compare ─── */}
      {step === "preview" && preview && (
        <section className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h1 className={styles.stepTitle}>See the difference</h1>
            <p className={styles.stepDesc}>
              Same topic, same purpose — but the brand-aware prompt includes your colors, voice, and identity.
            </p>
          </div>

          <div className={styles.comparisonWrap}>
            {/* Generic */}
            <div className={styles.promptPanel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelDot} style={{ background: "var(--text-muted)" }} />
                <span className={styles.panelLabel}>Without Orbit</span>
              </div>
              <div className={styles.promptBody}>
                {preview.generic.positive}
              </div>
            </div>

            <div className={styles.vsLabel}>vs</div>

            {/* Brand */}
            <div className={`${styles.promptPanel} ${styles.panelBrand}`}>
              <div className={styles.panelHeader}>
                <span className={styles.panelDot} style={{ background: "var(--accent)" }} />
                <span className={styles.panelLabel}>With Orbit + Brand</span>
                {preview.brandContext.used && (
                  <span className={styles.panelBadge}>Brand context active</span>
                )}
              </div>
              <div className={styles.promptBody}>
                {preview.brandAware.positive}
              </div>

              {/* Brand extras */}
              {preview.brandContext.colors && preview.brandContext.colors.length > 0 && (
                <div className={styles.brandExtras}>
                  <div className={styles.swatchRow}>
                    <span className={styles.swatchTitle}>Brand Colors:</span>
                    {preview.brandContext.colors.map((c, i) => (
                      <span key={i} className={styles.swatch} style={{ backgroundColor: c.hex }} title={`${c.role}: ${c.hex}`} />
                    ))}
                  </div>
                </div>
              )}
              {preview.brandContext.voiceTone && (
                <div className={styles.brandExtras}>
                  <span className={styles.swatchTitle}>Voice Tone:</span> {preview.brandContext.voiceTone}
                </div>
              )}
            </div>
          </div>

          <div className={styles.stepActions}>
            <button className={styles.secondaryBtn} onClick={() => setStep("input")} type="button">
              ← Edit Prompt
            </button>
            <button
              className={styles.primaryBtn}
              onClick={handleGenerate}
              disabled={generateLoading}
              type="button"
            >
              {generateLoading ? (
                <><span className={styles.btnSpinner} /> Generating...</>
              ) : (
                "Generate This Image (Free) →"
              )}
            </button>
          </div>
          <p className={styles.freeNote}>3 free per day. Standard quality. No account needed.</p>
        </section>
      )}

      {/* ─── STEP 3: Generated ─── */}
      {step === "generate" && generated && generated.images.length > 0 && (
        <section className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h1 className={styles.stepTitle}>Your brand-aware image</h1>
            <p className={styles.stepDesc}>
              Generated in {(generated.metadata.processingTimeMs / 1000).toFixed(1)}s using <strong>{generated.brand}</strong> brand context.
            </p>
          </div>

          <div className={styles.imageWrap}>
            <img
              className={styles.generatedImg}
              src={`data:${generated.images[0].mimeType};base64,${generated.images[0].base64}`}
              alt="AI-generated brand image"
              width={generated.images[0].dimensions.width}
              height={generated.images[0].dimensions.height}
            />
            <div className={styles.imageMeta}>
              <span className={styles.metaBrand}>{generated.brand}</span>
              <span className={styles.metaPurpose}>{purpose}</span>
              <span className={styles.metaTime}>{generated.metadata.processingTimeMs}ms</span>
            </div>
          </div>

          <div className={styles.stepActions}>
            <button className={styles.secondaryBtn} onClick={handleStartOver} type="button">
              ← Try Another
            </button>
            <button className={styles.primaryBtn} onClick={() => setStep("signup")} type="button">
              Get API Access →
            </button>
          </div>
        </section>
      )}

      {/* ─── STEP 4: Signup ─── */}
      {step === "signup" && (
        <section className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h1 className={styles.stepTitle}>Get your API key</h1>
            <p className={styles.stepDesc}>
              Integrate brand-aware image generation into your app, CMS, or workflow. Instant access.
            </p>
          </div>

          <div className={styles.card} style={{ maxWidth: 440 }}>
            {signupResult ? (
              <>
                <div className={styles.successBanner}>
                  {signupResult.username
                    ? `Account created! You're signed in as ${signupResult.username}`
                    : "Key created successfully"}
                </div>
                <div className={styles.keyBlock}>
                  <div className={styles.keyLabel}>Your API Key</div>
                  <code className={styles.keyValue}>{signupResult.apiKey}</code>
                  <button className={styles.copyBtn} onClick={handleCopy} type="button">
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </button>
                  <p className={styles.keyWarn}>Save this now. It won't be shown again.</p>
                </div>

                <div className={styles.limitsGrid}>
                  <div className={styles.limitCard}>
                    <span className={styles.limitValue}>10</span>
                    <span className={styles.limitLabel}>req/min</span>
                  </div>
                  <div className={styles.limitCard}>
                    <span className={styles.limitValue}>$1</span>
                    <span className={styles.limitLabel}>monthly budget</span>
                  </div>
                  <div className={styles.limitCard}>
                    <span className={styles.limitValue}>generate</span>
                    <span className={styles.limitLabel}>scope</span>
                  </div>
                </div>

                <Link href="/" className={styles.primaryBtn} style={{ textAlign: "center", display: "block", textDecoration: "none" }}>
                  Open Dashboard →
                </Link>
              </>
            ) : (
              <form className={styles.signupForm} onSubmit={handleSignup}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Email</label>
                  <input className={styles.fieldInput} name="email" type="email" placeholder="you@company.com" required />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Company</label>
                  <input className={styles.fieldInput} name="companyName" type="text" placeholder="Acme Inc" required />
                </div>
                <button className={styles.primaryBtn} type="submit" disabled={signupLoading}>
                  {signupLoading ? <><span className={styles.btnSpinner} /> Creating...</> : "Create API Key"}
                </button>
                <p className={styles.freeNote}>Free trial: 10 req/min, $1/month budget</p>
              </form>
            )}
          </div>

          <button className={styles.textLink} onClick={handleStartOver} type="button">
            ← Back to Studio
          </button>
        </section>
      )}
    </div>
  );
}
