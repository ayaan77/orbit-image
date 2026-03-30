"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import { CodeBlock } from "@/components/CodeBlock";
import { getSyncSnippet, getAsyncSnippet, getVerifySnippet, getMcpSnippet } from "@/lib/client/snippets";
import type { SnippetLang } from "@/lib/client/snippets";
import styles from "./QuickStart.module.css";

interface SnippetDef {
  readonly id: SnippetLang;
  readonly label: string;
}

const LANGUAGES: readonly SnippetDef[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

const PURPOSES = [
  { id: "blog-hero", label: "Blog Hero", size: "1536x1024", desc: "Article headers" },
  { id: "social-og", label: "Social / OG", size: "1536x1024", desc: "Feed images" },
  { id: "ad-creative", label: "Ad Creative", size: "1024x1024", desc: "Conversion ads" },
  { id: "case-study", label: "Case Study", size: "1536x1024", desc: "Results visuals" },
  { id: "icon", label: "Icon", size: "1024x1024", desc: "Symbolic icons" },
  { id: "infographic", label: "Infographic", size: "1024x1536", desc: "Tall data layouts" },
];

const MODELS = [
  { id: "gpt-image-1", provider: "OpenAI", speed: "~8s", quality: "High", cost: "~$0.01" },
  { id: "dall-e-3", provider: "OpenAI", speed: "~12s", quality: "Premium", cost: "~$0.04" },
  { id: "flux-pro", provider: "Replicate", speed: "~6s", quality: "Premium", cost: "~$0.05" },
  { id: "flux-dev", provider: "Replicate", speed: "~4s", quality: "High", cost: "~$0.01" },
  { id: "flux-schnell", provider: "Replicate", speed: "~2s", quality: "Good", cost: "~$0.003" },
  { id: "grok-aurora", provider: "xAI", speed: "~10s", quality: "Creative", cost: "varies" },
];

const STYLES = [
  "photographic", "illustration", "3d-render", "flat-design", "abstract", "minimalist",
];

const ENV_ESSENTIALS = [
  { var: "OPENAI_API_KEY", required: true, desc: "OpenAI API key — enables GPT Image 1 and DALL-E 3" },
  { var: "API_SECRET_KEY", required: true, desc: "Master auth token — protects all API routes" },
  { var: "REPLICATE_API_TOKEN", required: false, desc: "Adds Flux Pro, Dev & Schnell models (replicate.com)" },
  { var: "XAI_API_KEY", required: false, desc: "Adds Grok Aurora model (console.x.ai)" },
  { var: "CORTEX_BASE_URL", required: false, desc: "Brand context API — HTTPS URL to your Cortex instance" },
  { var: "DEFAULT_BRAND", required: false, desc: "Auto-select brand for all requests (default: apexure)" },
];

const INFRA_SERVICES = [
  { service: "Upstash Redis", enables: "Per-app API keys, rate limiting, async job queue", vars: "KV_REST_API_URL, KV_REST_API_TOKEN", source: "upstash.com (free tier)" },
  { service: "Neon Postgres", enables: "Usage tracking, cost analytics, webhook logs", vars: "POSTGRES_URL", source: "Vercel Storage or neon.tech" },
  { service: "Vercel Blob", enables: "CDN image URLs instead of base64 data", vars: "BLOB_READ_WRITE_TOKEN", source: "Vercel Storage dashboard" },
  { service: "Webhook signing", enables: "HMAC-signed async delivery payloads", vars: "WEBHOOK_SECRET", source: "openssl rand -hex 32" },
];

const TUNING_VARS = [
  { var: "RATE_LIMIT_PER_MINUTE", def: "60", desc: "Max requests per client per minute" },
  { var: "MAX_CONCURRENT_GENERATES", def: "3", desc: "Parallel image generation slots" },
  { var: "CACHE_TTL_SECONDS", def: "3600", desc: "Brand context cache lifetime (1 hour)" },
  { var: "IMAGE_CACHE_TTL_SECONDS", def: "86400", desc: "Generated image cache lifetime (24 hours)" },
  { var: "LOG_LEVEL", def: "info", desc: "Logging verbosity: debug, info, warn, error" },
];

export function QuickStart() {
  const [activeLang, setActiveLang] = useState<SnippetLang>("curl");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");
  const { showToast } = useToast();

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const opts = { baseUrl, apiKey: "" };

  const handleTestCall = useCallback(async () => {
    setTestLoading(true);
    setTestResult("idle");
    try {
      const res = await apiFetch("/api/health");
      const data = await res.json();
      if (res.ok && data.status) {
        setTestResult("success");
        showToast(`API is reachable. Status: ${data.status}`, "success");
      } else {
        setTestResult("error");
        showToast("API returned an error", "error");
      }
    } catch {
      setTestResult("error");
      showToast("Could not reach the API", "error");
    } finally {
      setTestLoading(false);
    }
  }, [showToast]);

  function LangTabs() {
    return (
      <div className={styles.langTabs}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            className={`${styles.langTab} ${activeLang === lang.id ? styles.langTabActive : ""}`}
            onClick={() => setActiveLang(lang.id)}
          >
            {lang.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ─── What you need ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h3 className={styles.sectionTitle}>What you need</h3>
        </div>
        <p className={styles.sectionDesc}>
          Set these as environment variables in your hosting platform (Vercel, Railway, etc.). Only OpenAI and the auth key are required — everything else unlocks additional features.
        </p>
        <div className={styles.refTable}>
          <div className={styles.refHeader}>
            <span>Variable</span>
            <span>Required</span>
            <span>Description</span>
          </div>
          {ENV_ESSENTIALS.map((e) => (
            <div key={e.var} className={styles.refRow}>
              <code className={styles.refCode}>{e.var}</code>
              <span className={e.required ? styles.refRequired : styles.refMuted}>{e.required ? "Yes" : "No"}</span>
              <span className={styles.refMuted}>{e.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Step 1: Test Connection ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>1</span>
          <h3 className={styles.sectionTitle}>Test your connection</h3>
        </div>
        <p className={styles.sectionDesc}>
          Make sure your API key works before writing any code.
        </p>
        <div className={styles.testRow}>
          <button
            className={`${styles.testBtn} ${testResult === "success" ? styles.testBtnSuccess : testResult === "error" ? styles.testBtnError : ""}`}
            onClick={handleTestCall}
            disabled={testLoading}
          >
            {testLoading ? "Testing..." : testResult === "success" ? "Connected" : testResult === "error" ? "Failed — Retry" : "Test API Connection"}
          </button>
          <code className={styles.testEndpoint}>GET /api/health</code>
        </div>
      </div>

      {/* ─── Step 2: Generate an Image ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>2</span>
          <h3 className={styles.sectionTitle}>Generate your first image</h3>
        </div>
        <p className={styles.sectionDesc}>
          One API call. Send a topic and purpose, get back an image. Your brand context is applied automatically.
        </p>
        <LangTabs />
        <CodeBlock code={getSyncSnippet(activeLang, opts)} id="quickstart-sync" />
      </div>

      {/* ─── Reference: Purposes ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>?</span>
          <h3 className={styles.sectionTitle}>Available purposes</h3>
        </div>
        <p className={styles.sectionDesc}>
          Each purpose uses a different template, default dimensions, and prompt structure.
        </p>
        <div className={styles.refTable}>
          <div className={styles.refHeader}>
            <span>Purpose</span>
            <span>Default Size</span>
            <span>Best For</span>
          </div>
          {PURPOSES.map((p) => (
            <div key={p.id} className={styles.refRow}>
              <code className={styles.refCode}>{p.id}</code>
              <span className={styles.refMuted}>{p.size}</span>
              <span className={styles.refMuted}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Reference: Models ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>?</span>
          <h3 className={styles.sectionTitle}>Available models</h3>
        </div>
        <p className={styles.sectionDesc}>
          Pass <code>model</code> in your request to choose. Default is <code>gpt-image-1</code>.
        </p>
        <div className={styles.refTable}>
          <div className={styles.refHeader}>
            <span>Model</span>
            <span>Provider</span>
            <span>Speed</span>
            <span>Cost/img</span>
          </div>
          {MODELS.map((m) => (
            <div key={m.id} className={styles.refRow}>
              <code className={styles.refCode}>{m.id}</code>
              <span className={styles.refMuted}>{m.provider}</span>
              <span className={styles.refMuted}>{m.speed}</span>
              <span className={styles.refMuted}>{m.cost}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Reference: Styles ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>?</span>
          <h3 className={styles.sectionTitle}>Available styles</h3>
        </div>
        <p className={styles.sectionDesc}>
          Optional. Pass <code>style</code> to control the visual approach.
        </p>
        <div className={styles.chipRow}>
          {STYLES.map((s) => (
            <code key={s} className={styles.chip}>{s}</code>
          ))}
        </div>
      </div>

      {/* ─── Step 3: Async + Webhooks ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>3</span>
          <h3 className={styles.sectionTitle}>Async generation + webhooks</h3>
        </div>
        <p className={styles.sectionDesc}>
          For background processing: get a job ID immediately, receive the image via webhook when ready. No waiting.
        </p>
        <CodeBlock code={getAsyncSnippet(opts)} id="quickstart-async" />
      </div>

      {/* ─── Step 4: Webhook Verification ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>4</span>
          <h3 className={styles.sectionTitle}>Verify webhook signatures</h3>
        </div>
        <p className={styles.sectionDesc}>
          Always verify the <code>X-Orbit-Signature</code> header using HMAC-SHA256 before trusting webhook payloads.
        </p>
        <LangTabs />
        <CodeBlock code={getVerifySnippet(activeLang)} id="verify-sig" />
      </div>

      {/* ─── Webhook Payload Example ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h3 className={styles.sectionTitle}>Webhook payload format</h3>
        </div>
        <CodeBlock
          id="webhook-payload"
          code={`{
  "event": "generation.completed",
  "jobId": "job_abc123",
  "timestamp": "2026-03-27T10:00:00.000Z",
  "data": {
    "images": [
      {
        "url": "https://blob.vercel-storage.com/orbit/apexure/blog-hero/...",
        "prompt": "Professional editorial-style hero image for...",
        "mimeType": "image/png",
        "dimensions": { "width": 1536, "height": 1024 }
      }
    ],
    "brand": "apexure",
    "processingTimeMs": 8340
  }
}`}
        />
      </div>

      {/* ─── Step 5: MCP ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>5</span>
          <h3 className={styles.sectionTitle}>Connect to AI assistants (MCP)</h3>
        </div>
        <p className={styles.sectionDesc}>
          Add Orbit to Claude Desktop, Cursor, or any MCP client. The AI calls <code>generate_image</code> automatically — just ask for images in natural language.
        </p>
        <CodeBlock code={getMcpSnippet(opts)} id="mcp-config" />
      </div>

      {/* ─── Full Request Schema ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h3 className={styles.sectionTitle}>Full request schema</h3>
        </div>
        <div className={styles.refTable}>
          <div className={styles.refHeader}>
            <span>Field</span>
            <span>Type</span>
            <span>Required</span>
            <span>Notes</span>
          </div>
          {[
            { field: "topic", type: "string", req: "Yes", note: "What to visualize (1-500 chars)" },
            { field: "purpose", type: "enum", req: "Yes", note: "blog-hero, social-og, ad-creative, case-study, icon, infographic" },
            { field: "brand", type: "string", req: "No", note: "Brand ID from Cortex (default: apexure)" },
            { field: "model", type: "enum", req: "No", note: "See models table above (default: gpt-image-1)" },
            { field: "style", type: "enum", req: "No", note: "Visual style modifier" },
            { field: "quality", type: "enum", req: "No", note: "standard or hd (default: hd)" },
            { field: "count", type: "number", req: "No", note: "1-4 images (default: 1)" },
            { field: "output_format", type: "enum", req: "No", note: "base64 or url (default: base64)" },
            { field: "async", type: "boolean", req: "No", note: "true for background generation" },
            { field: "webhook_url", type: "string", req: "No", note: "HTTPS URL for async delivery" },
            { field: "audience", type: "string", req: "No", note: "Target audience from Cortex" },
            { field: "persona", type: "string", req: "No", note: "Persona name from Cortex" },
            { field: "industry", type: "string", req: "No", note: "Industry context for proof data" },
          ].map((r) => (
            <div key={r.field} className={styles.refRow}>
              <code className={styles.refCode}>{r.field}</code>
              <span className={styles.refMuted}>{r.type}</span>
              <span className={styles.refMuted}>{r.req}</span>
              <span className={styles.refMuted}>{r.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Infrastructure services ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="14" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" /><circle cx="6" cy="6" r="1" fill="currentColor" /><circle cx="6" cy="18" r="1" fill="currentColor" /></svg>
          </span>
          <h3 className={styles.sectionTitle}>Infrastructure services</h3>
        </div>
        <p className={styles.sectionDesc}>
          All optional. Each unlocks features that make Orbit production-ready. See the Dashboard overview for step-by-step setup instructions.
        </p>
        <div className={styles.refTable}>
          <div className={styles.refHeader}>
            <span>Service</span>
            <span>What it enables</span>
            <span>Env vars</span>
            <span>Where to get it</span>
          </div>
          {INFRA_SERVICES.map((s) => (
            <div key={s.service} className={styles.refRow}>
              <span className={styles.refMuted}><strong>{s.service}</strong></span>
              <span className={styles.refMuted}>{s.enables}</span>
              <span className={styles.refVarList}>{s.vars}</span>
              <span className={styles.refMuted}>{s.source}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tuning ─── */}
      <div className={styles.section}>
        <div className={styles.stepHeader}>
          <span className={styles.stepBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h3 className={styles.sectionTitle}>Tuning</h3>
        </div>
        <p className={styles.sectionDesc}>
          Fine-tune performance and behavior. These all have sensible defaults — only change them if you need to.
        </p>
        <div className={styles.refTable}>
          <div className={styles.refHeader}>
            <span>Variable</span>
            <span>Default</span>
            <span>Description</span>
          </div>
          {TUNING_VARS.map((t) => (
            <div key={t.var} className={styles.refRow}>
              <code className={styles.refCode}>{t.var}</code>
              <code className={styles.refCode}>{t.def}</code>
              <span className={styles.refMuted}>{t.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
