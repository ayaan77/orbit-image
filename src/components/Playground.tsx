"use client";

import { useState, useCallback } from "react";
import { getApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
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

interface PlaygroundState {
  readonly topic: string;
  readonly purpose: string;
  readonly brand: string;
  readonly quality: string;
  readonly count: number;
  readonly style: string;
  readonly persona: string;
  readonly async: boolean;
  readonly webhookUrl: string;
}

const DEFAULT_STATE: PlaygroundState = {
  topic: "",
  purpose: "blog-hero",
  brand: "apexure",
  quality: "hd",
  count: 1,
  style: "",
  persona: "",
  async: false,
  webhookUrl: "",
};

export function Playground() {
  const [form, setForm] = useState<PlaygroundState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const { showToast } = useToast();

  const updateField = useCallback(
    <K extends keyof PlaygroundState>(key: K, value: PlaygroundState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const key = getApiKey();
    if (!key) {
      showToast("Configure your API key first", "error");
      return;
    }
    if (!form.topic.trim()) {
      showToast("Topic is required", "error");
      return;
    }

    setLoading(true);
    setResponse(null);
    setResponseStatus(null);
    setElapsed(null);

    const body: Record<string, unknown> = {
      topic: form.topic.trim(),
      purpose: form.purpose,
      brand: form.brand || undefined,
      quality: form.quality,
      count: form.count,
    };
    if (form.style.trim()) body.style = form.style.trim();
    if (form.persona.trim()) body.persona = form.persona.trim();
    if (form.async) {
      body.async = true;
      if (form.webhookUrl.trim()) body.webhook_url = form.webhookUrl.trim();
    }

    const start = Date.now();
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResponseStatus(res.status);
      setElapsed(Date.now() - start);

      // Truncate base64 in display for readability
      const display = JSON.parse(JSON.stringify(data));
      if (display.images) {
        for (const img of display.images) {
          if (img.base64 && img.base64.length > 80) {
            img.base64 = img.base64.slice(0, 80) + "... (truncated)";
          }
        }
      }
      setResponse(JSON.stringify(display, null, 2));
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

  const handleCopyResponse = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response).then(() => {
        showToast("Response copied", "success");
      });
    }
  }, [response, showToast]);

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
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Brand</label>
              <input
                className={styles.input}
                placeholder="apexure"
                value={form.brand}
                onChange={(e) => updateField("brand", e.target.value)}
              />
            </div>
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
          </div>

          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Style</label>
              <input
                className={styles.input}
                placeholder="e.g. minimalist, isometric"
                value={form.style}
                onChange={(e) => updateField("style", e.target.value)}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Persona</label>
              <input
                className={styles.input}
                placeholder="e.g. startup-founder"
                value={form.persona}
                onChange={(e) => updateField("persona", e.target.value)}
              />
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
                <button
                  className={styles.copyResponseBtn}
                  onClick={handleCopyResponse}
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {response ? (
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
