"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import { MODEL_CATALOG, MODEL_IDS, DEFAULT_MODEL, type ModelId } from "@/lib/providers/models";
import { ImageGallery } from "./ImageGallery";
import styles from "./Playground.module.css";

const PURPOSES = [
  "blog-hero",
  "social-og",
  "ad-creative",
  "case-study",
  "icon",
  "infographic",
] as const;

const QUALITIES = ["standard", "hd"] as const;

const IMAGE_STYLES = [
  "photographic",
  "illustration",
  "3d-render",
  "flat-design",
  "abstract",
  "minimalist",
] as const;

interface ImageResult {
  readonly base64: string;
  readonly url?: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface ParsedImageResponse {
  readonly images: readonly ImageResult[];
  readonly brand: string;
  readonly metadata: {
    readonly processingTimeMs: number;
    readonly cortexDataCached: boolean;
    readonly resultCached?: boolean;
  };
}

interface PlaygroundState {
  readonly topic: string;
  readonly purpose: string;
  readonly model: ModelId;
  readonly brand: string;
  readonly quality: string;
  readonly count: number;
  readonly style: string;
  readonly persona: string;
  readonly async: boolean;
  readonly webhookUrl: string;
  readonly outputFormat: "base64" | "url";
}

const DEFAULT_STATE: PlaygroundState = {
  topic: "",
  purpose: "blog-hero",
  model: DEFAULT_MODEL,
  brand: "apexure",
  quality: "hd",
  count: 1,
  style: "",
  persona: "",
  async: false,
  webhookUrl: "",
  outputFormat: "base64",
};

export function Playground() {
  const [form, setForm] = useState<PlaygroundState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [responseImages, setResponseImages] = useState<ParsedImageResponse | null>(null);
  const [asyncJob, setAsyncJob] = useState<{ jobId: string; statusUrl: string } | null>(null);
  const [viewJson, setViewJson] = useState(false);
  const [jobPolling, setJobPolling] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    positive: string;
    negative: string;
    brandContextUsed: boolean;
    brand: string;
  } | null>(null);
  const { showToast } = useToast();

  const updateField = useCallback(
    <K extends keyof PlaygroundState>(key: K, value: PlaygroundState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSend = useCallback(async () => {
    if (!form.topic.trim()) {
      showToast("Topic is required", "error");
      return;
    }

    setLoading(true);
    setResponse(null);
    setResponseStatus(null);
    setElapsed(null);
    setResponseImages(null);
    setAsyncJob(null);
    setViewJson(false);

    const body: Record<string, unknown> = {
      topic: form.topic.trim(),
      purpose: form.purpose,
      model: form.model,
      brand: form.brand || undefined,
      quality: form.quality,
      count: form.count,
      output_format: form.outputFormat,
    };
    if (form.style) body.style = form.style;
    if (form.persona.trim()) body.persona = form.persona.trim();
    if (form.async) {
      body.async = true;
      if (form.webhookUrl.trim()) body.webhook_url = form.webhookUrl.trim();
    }

    const start = Date.now();
    try {
      const res = await apiFetch("/api/generate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResponseStatus(res.status);
      setElapsed(Date.now() - start);

      if (res.ok && data.success && Array.isArray(data.images)) {
        setResponseImages({
          images: data.images as ImageResult[],
          brand: data.brand,
          metadata: data.metadata,
        });
        // Build truncated JSON for "View JSON" toggle
        const display = JSON.parse(JSON.stringify(data));
        for (const img of display.images ?? []) {
          if (img.base64?.length > 80) img.base64 = img.base64.slice(0, 80) + "... (truncated)";
        }
        setResponse(JSON.stringify(display, null, 2));
      } else if (res.ok && data.success && data.async) {
        setAsyncJob({ jobId: data.jobId, statusUrl: data.statusUrl });
        setResponse(JSON.stringify(data, null, 2));
      } else {
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      setElapsed(Date.now() - start);
      setResponseStatus(0);
      setResponse(
        JSON.stringify(
          { error: err instanceof Error ? err.message : "Network error" },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [form, showToast]);

  const handlePollStatus = useCallback(async () => {
    if (!asyncJob) return;

    setJobPolling(true);
    let attempts = 0;
    const maxAttempts = 15;

    const poll = async (): Promise<void> => {
      attempts++;
      try {
        const res = await apiFetch(`/api/jobs/${asyncJob.jobId}`);
        const data = await res.json();

        if (data.status === "completed" && data.result?.images) {
          setResponseImages({
            images: data.result.images as ImageResult[],
            brand: data.result.brand,
            metadata: {
              processingTimeMs: data.result.processingTimeMs,
              cortexDataCached: data.result.cortexDataCached,
              resultCached: data.result.resultCached,
            },
          });
          setAsyncJob(null);
          setJobPolling(false);
        } else if (data.status === "failed") {
          setResponse(JSON.stringify(data, null, 2));
          setAsyncJob(null);
          setJobPolling(false);
        } else if (attempts < maxAttempts) {
          setTimeout(() => void poll(), 2000);
        } else {
          showToast("Job timed out — check status manually", "error");
          setJobPolling(false);
        }
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(() => void poll(), 2000);
        } else {
          showToast("Polling failed", "error");
          setJobPolling(false);
        }
      }
    };

    await poll();
  }, [asyncJob, showToast]);

  const handlePreview = useCallback(async () => {
    if (!form.topic.trim()) { showToast("Topic is required", "error"); return; }

    setPreviewLoading(true);
    try {
      const body: Record<string, unknown> = {
        topic: form.topic.trim(),
        purpose: form.purpose,
        model: form.model,
        brand: form.brand || undefined,
        quality: form.quality,
        count: form.count,
      };
      if (form.style) body.style = form.style;
      if (form.persona.trim()) body.persona = form.persona.trim();

      const res = await apiFetch("/api/admin/preview-prompt", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData({
          positive: data.prompt.positive,
          negative: data.prompt.negative,
          brandContextUsed: data.brandContextUsed,
          brand: data.brand,
        });
        setPreviewOpen(true);
      } else {
        showToast(data.error?.message ?? "Preview failed", "error");
      }
    } catch {
      showToast("Preview failed", "error");
    } finally {
      setPreviewLoading(false);
    }
  }, [form, showToast]);

  const handleCopyResponse = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response).then(() => {
        showToast("Response copied", "success");
      });
    }
  }, [response, showToast]);

  const selectedModel = MODEL_CATALOG[form.model];

  return (
    <div className={styles.container}>
      <div className={styles.split}>
        {/* Request Form */}
        <div className={styles.requestPanel}>
          <h3 className={styles.panelTitle}>Request</h3>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Topic *</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe the image you want..."
              value={form.topic}
              onChange={(e) => updateField("topic", e.target.value)}
              rows={3}
            />
          </div>

          {/* Purpose + Model */}
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Purpose</label>
              <select
                className={styles.select}
                value={form.purpose}
                onChange={(e) => updateField("purpose", e.target.value)}
              >
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Model</label>
              <select
                className={styles.select}
                value={form.model}
                onChange={(e) => updateField("model", e.target.value as ModelId)}
              >
                {MODEL_IDS.map((id) => (
                  <option key={id} value={id}>
                    {MODEL_CATALOG[id].displayName}
                  </option>
                ))}
              </select>
              <span
                className={`${styles.modelBadge} ${
                  selectedModel.provider === "openai"
                    ? styles.modelBadgeOpenAI
                    : selectedModel.provider === "replicate"
                    ? styles.modelBadgeReplicate
                    : styles.modelBadgeXAI
                }`}
              >
                {selectedModel.badge}
                {selectedModel.tier === "fast" && " · Fast"}
                {selectedModel.tier === "premium" && " · Premium"}
              </span>
            </div>
          </div>

          {/* Quality + Brand */}
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Quality</label>
              <select
                className={styles.select}
                value={form.quality}
                onChange={(e) => updateField("quality", e.target.value)}
              >
                {QUALITIES.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Brand</label>
              <input
                className={styles.input}
                placeholder="apexure"
                value={form.brand}
                onChange={(e) => updateField("brand", e.target.value)}
              />
            </div>
          </div>

          {/* Count + Style */}
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Count</label>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={4}
                value={form.count}
                onChange={(e) =>
                  updateField("count", parseInt(e.target.value, 10) || 1)
                }
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Style</label>
              <select
                className={styles.select}
                value={form.style}
                onChange={(e) => updateField("style", e.target.value)}
              >
                <option value="">default</option>
                {IMAGE_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Persona + Output Format */}
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Persona</label>
              <input
                className={styles.input}
                placeholder="e.g. startup-founder"
                value={form.persona}
                onChange={(e) => updateField("persona", e.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Output Format</label>
              <select
                className={styles.select}
                value={form.outputFormat}
                onChange={(e) =>
                  updateField("outputFormat", e.target.value as "base64" | "url")
                }
              >
                <option value="base64">base64</option>
                <option value="url">url (Blob)</option>
              </select>
            </div>
          </div>

          <div className={styles.asyncSection}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.async}
                onChange={(e) => updateField("async", e.target.checked)}
              />
              <span>Async mode</span>
            </label>
            {form.async && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Webhook URL</label>
                <input
                  className={styles.input}
                  placeholder="https://yourapp.com/webhook"
                  value={form.webhookUrl}
                  onChange={(e) => updateField("webhookUrl", e.target.value)}
                />
              </div>
            )}
          </div>

          <div className={styles.actionRow}>
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Sending...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Send Request
                </>
              )}
            </button>
            <button
              className={`${styles.previewBtn} ${previewOpen ? styles.previewBtnActive : ""}`}
              onClick={previewOpen ? () => setPreviewOpen(false) : handlePreview}
              disabled={previewLoading}
            >
              {previewLoading ? "Loading…" : previewOpen ? "Hide Prompt" : "Preview Prompt"}
            </button>
          </div>

          {/* Prompt Preview Panel */}
          {previewOpen && previewData && (
            <div className={styles.previewPanel}>
              <div className={styles.previewHeader}>
                <span className={styles.previewTitle}>Assembled Prompt</span>
                <span
                  className={`${styles.previewBadge} ${
                    previewData.brandContextUsed
                      ? styles.previewBadgeOk
                      : styles.previewBadgeWarn
                  }`}
                >
                  {previewData.brandContextUsed
                    ? `Brand: ${previewData.brand}`
                    : "No brand context (Cortex unavailable)"}
                </span>
              </div>
              <div className={styles.previewSection}>
                <div className={styles.previewLabel}>Positive prompt</div>
                <pre className={styles.previewText}>{previewData.positive}</pre>
              </div>
              <div className={styles.previewSection}>
                <div className={styles.previewLabel}>Negative prompt</div>
                <pre className={styles.previewText}>{previewData.negative}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Response Panel */}
        <div className={styles.responsePanel}>
          <div className={styles.responsePanelHeader}>
            <h3 className={styles.panelTitle}>Response</h3>
            {responseStatus !== null && (
              <div className={styles.responseMeta}>
                <span
                  className={`${styles.statusBadge} ${
                    responseStatus >= 200 && responseStatus < 300
                      ? styles.statusOk
                      : styles.statusErr
                  }`}
                >
                  {responseStatus}
                </span>
                {elapsed !== null && (
                  <span className={styles.elapsed}>{elapsed}ms</span>
                )}
                {responseImages && (
                  <button
                    className={`${styles.copyResponseBtn} ${viewJson ? styles.viewJsonActive : ""}`}
                    onClick={() => setViewJson((v) => !v)}
                  >
                    {viewJson ? "Images" : "JSON"}
                  </button>
                )}
                <button
                  className={styles.copyResponseBtn}
                  onClick={handleCopyResponse}
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {responseImages && !viewJson ? (
            <ImageGallery
              images={responseImages.images}
              brand={responseImages.brand}
              processingTimeMs={responseImages.metadata.processingTimeMs}
              cortexDataCached={responseImages.metadata.cortexDataCached}
              resultCached={responseImages.metadata.resultCached ?? false}
            />
          ) : asyncJob ? (
            <div className={styles.asyncJobPanel}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className={styles.asyncJobIcon}
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 6v6l4 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <p className={styles.asyncJobTitle}>Job Queued</p>
              <p className={styles.asyncJobId}>{asyncJob.jobId}</p>
              <button
                className={styles.pollBtn}
                onClick={() => void handlePollStatus()}
                disabled={jobPolling}
              >
                {jobPolling ? (
                  <>
                    <span className={styles.spinner} />
                    Polling...
                  </>
                ) : (
                  "Check Status"
                )}
              </button>
            </div>
          ) : response ? (
            <pre className={styles.responseCode}>{response}</pre>
          ) : (
            <div className={styles.responseEmpty}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p>Send a request to see the response</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
