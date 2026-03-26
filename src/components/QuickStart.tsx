"use client";

import { useState, useCallback } from "react";
import { getApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import styles from "./QuickStart.module.css";

type Language = "curl" | "javascript" | "python";

interface SnippetDef {
  readonly id: Language;
  readonly label: string;
}

const LANGUAGES: readonly SnippetDef[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
] as const;

function getSnippet(lang: Language, baseUrl: string, apiKey: string): string {
  const key = apiKey || "YOUR_API_KEY";

  if (lang === "curl") {
    return `curl -X POST ${baseUrl}/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "topic": "A modern SaaS dashboard",
    "purpose": "blog-hero",
    "brand": "apexure",
    "quality": "hd",
    "count": 1
  }'`;
  }

  if (lang === "javascript") {
    return `const response = await fetch("${baseUrl}/api/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${key}",
  },
  body: JSON.stringify({
    topic: "A modern SaaS dashboard",
    purpose: "blog-hero",
    brand: "apexure",
    quality: "hd",
    count: 1,
  }),
});

const data = await response.json();

if (data.success) {
  // data.images[0].base64 — base64-encoded image
  // data.images[0].mimeType — "image/png"
  console.log(\`Generated \${data.images.length} image(s)\`);
}`;
  }

  // python
  return `import requests

response = requests.post(
    "${baseUrl}/api/generate",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer ${key}",
    },
    json={
        "topic": "A modern SaaS dashboard",
        "purpose": "blog-hero",
        "brand": "apexure",
        "quality": "hd",
        "count": 1,
    },
)

data = response.json()

if data["success"]:
    # data["images"][0]["base64"] — base64-encoded image
    # data["images"][0]["mimeType"] — "image/png"
    print(f"Generated {len(data['images'])} image(s)")`;
}

function getAsyncSnippet(baseUrl: string, apiKey: string): string {
  const key = apiKey || "YOUR_API_KEY";
  return `# Async generation with webhook callback
curl -X POST ${baseUrl}/api/generate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{
    "topic": "Product launch hero image",
    "purpose": "blog-hero",
    "async": true,
    "webhook_url": "https://yourapp.com/webhooks/orbit"
  }'

# Response: { "jobId": "job_abc123", "statusUrl": "..." }

# Poll for status:
curl ${baseUrl}/api/jobs/JOB_ID \\
  -H "Authorization: Bearer ${key}"`;
}

export function QuickStart() {
  const [activeLang, setActiveLang] = useState<Language>("curl");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { showToast } = useToast();

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const apiKey = getApiKey();

  const handleCopy = useCallback(
    (code: string, id: string) => {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedId(id);
        showToast("Copied to clipboard", "success");
        setTimeout(() => setCopiedId(null), 2000);
      });
    },
    [showToast],
  );

  const syncSnippet = getSnippet(activeLang, baseUrl, apiKey);
  const asyncSnippet = getAsyncSnippet(baseUrl, apiKey);

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

        <div className={styles.codeBlock}>
          <button
            className={styles.copyCodeBtn}
            onClick={() => handleCopy(syncSnippet, "sync")}
          >
            {copiedId === "sync" ? "Copied" : "Copy"}
          </button>
          <pre className={styles.code}>{syncSnippet}</pre>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Async Generation + Webhooks</h3>
        <p className={styles.sectionDesc}>
          Get a job ID immediately and receive results via webhook or polling. Best
          for background processing.
        </p>

        <div className={styles.codeBlock}>
          <button
            className={styles.copyCodeBtn}
            onClick={() => handleCopy(asyncSnippet, "async")}
          >
            {copiedId === "async" ? "Copied" : "Copy"}
          </button>
          <pre className={styles.code}>{asyncSnippet}</pre>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Webhook Payload</h3>
        <p className={styles.sectionDesc}>
          Webhook payloads are signed with HMAC-SHA256. Verify the{" "}
          <code>X-Orbit-Signature</code> header.
        </p>
        <div className={styles.codeBlock}>
          <pre className={styles.code}>
{`{
  "event": "generation.completed",
  "jobId": "job_abc123",
  "timestamp": "2026-03-26T10:00:00.000Z",
  "data": {
    "images": [
      {
        "base64": "iVBORw0KGgo...",
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
          </pre>
        </div>
      </div>
    </div>
  );
}
