"use client";

import { useState, useCallback } from "react";
import { getApiKey } from "@/lib/client/storage";
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
] as const;

export function QuickStart() {
  const [activeLang, setActiveLang] = useState<SnippetLang>("curl");
  const { showToast } = useToast();

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const apiKey = getApiKey();

  const opts = { baseUrl, apiKey };
  const syncSnippet = getSyncSnippet(activeLang, opts);
  const asyncSnippet = getAsyncSnippet(opts);
  const mcpSnippet = getMcpSnippet(opts);

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Sync Generation</h3>
        <p className={styles.sectionDesc}>
          Send a request and wait for the result. Best for real-time UIs.
        </p>

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

        <CodeBlock code={syncSnippet} id="quickstart-sync" />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Async Generation + Webhooks</h3>
        <p className={styles.sectionDesc}>
          Get a job ID immediately and receive results via webhook or polling. Best
          for background processing.
        </p>

        <CodeBlock code={asyncSnippet} id="quickstart-async" />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Webhook Payload</h3>
        <p className={styles.sectionDesc}>
          Webhook payloads are signed with HMAC-SHA256. Always verify the{" "}
          <code>X-Orbit-Signature</code> header before trusting the payload.
        </p>
        <CodeBlock
          id="webhook-payload"
          code={`{
  "event": "generation.completed",
  "jobId": "job_abc123",
  "timestamp": "2026-03-26T10:00:00.000Z",
  "data": {
    "images": [
      {
        "url": "https://blob.vercel-storage.com/...",
        "prompt": "...",
        "mimeType": "image/png",
        "dimensions": { "width": 1024, "height": 1024 }
      }
    ],
    "brand": "apexure",
    "processingTimeMs": 12340,
    "cortexDataCached": false
  }
}`}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Verify Webhook Signatures</h3>
        <p className={styles.sectionDesc}>
          Use your <code>WEBHOOK_SECRET</code> to verify every incoming webhook.
          Reject requests that fail verification.
        </p>

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

        <CodeBlock code={getVerifySnippet(activeLang)} id="verify-sig" />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>MCP / AI Assistants</h3>
        <p className={styles.sectionDesc}>
          Connect Orbit Image directly to Claude, Cursor, or any MCP-compatible AI. The assistant
          calls <code>generate_image</code> automatically when you ask for images — no code needed.
        </p>
        <CodeBlock code={mcpSnippet} id="mcp-config" />
      </div>
    </div>
  );
}
