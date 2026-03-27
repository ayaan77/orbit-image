"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { getApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import { CodeBlock } from "@/components/CodeBlock";
import { getSyncSnippet, getAsyncSnippet } from "@/lib/client/snippets";
import type { SnippetLang } from "@/lib/client/snippets";
import styles from "./AppsPanel.module.css";

interface ClientInfo {
  readonly clientId: string;
  readonly clientName: string;
  readonly createdAt: string;
  readonly active: boolean;
  readonly rateLimit?: number;
  readonly scopes?: readonly string[];
  readonly defaultWebhookUrl?: string;
  readonly monthlyBudgetUsd?: number;
}

interface UsageSummary {
  readonly totalImages: number;
  readonly totalCostUsd: number;
}

interface DeliveryLog {
  readonly jobId: string;
  readonly url: string;
  readonly status: string;
  readonly attempts: number;
  readonly lastAttemptAt: string | null;
  readonly responseStatus: number | null;
  readonly error: string | null;
}

// ─── Integration Guide (shown after key creation) ───

interface IntegrationGuideProps {
  readonly apiKey: string;
  readonly clientName: string;
  readonly webhookUrl?: string;
  readonly purpose?: string;
  readonly onDismiss: () => void;
}

function IntegrationGuide({ apiKey, clientName, webhookUrl, purpose, onDismiss }: IntegrationGuideProps) {
  const [keyCopied, setKeyCopied] = useState(false);
  const [activeLang, setActiveLang] = useState<SnippetLang>("curl");
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCopyKey = useCallback(() => {
    navigator.clipboard.writeText(apiKey).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    });
  }, [apiKey]);

  const opts = { baseUrl, apiKey, webhookUrl, purpose };
  const syncSnippet = getSyncSnippet(activeLang, opts);
  const asyncSnippet = getAsyncSnippet(opts);

  const LANGS: readonly { id: SnippetLang; label: string }[] = [
    { id: "curl", label: "cURL" },
    { id: "javascript", label: "JavaScript" },
    { id: "python", label: "Python" },
  ];

  return (
    <div className={styles.guide}>
      {/* Header */}
      <div className={styles.guideHeader}>
        <div className={styles.guideHeaderLeft}>
          <div className={styles.guideSuccessIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className={styles.guideTitle}>"{clientName}" is ready to connect</div>
            <div className={styles.guideSubtitle}>Save the API key — it won't be shown again</div>
          </div>
        </div>
        <button className={styles.guideDismiss} onClick={onDismiss}>Done</button>
      </div>

      {/* Step 1: Copy the key */}
      <div className={styles.guideStep}>
        <div className={styles.guideStepLabel}>Step 1 — Copy this API key and give it to the app developer</div>
        <div className={styles.keyRow}>
          <code className={styles.keyCode}>{apiKey}</code>
          <button className={styles.copyKeyBtn} onClick={handleCopyKey}>
            {keyCopied ? "Copied!" : "Copy Key"}
          </button>
        </div>
      </div>

      {/* Step 2: Code snippets */}
      <div className={styles.guideStep}>
        <div className={styles.guideStepLabel}>Step 2 — The app calls this endpoint to request an image</div>
        <div className={styles.langTabs}>
          {LANGS.map((lang) => (
            <button
              key={lang.id}
              className={`${styles.langTab} ${activeLang === lang.id ? styles.langTabActive : ""}`}
              onClick={() => setActiveLang(lang.id)}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <CodeBlock code={syncSnippet} id={`guide-sync-${clientName}`} />
      </div>

      {/* Step 3: Async / webhook */}
      <div className={styles.guideStep}>
        <div className={styles.guideStepLabel}>
          Step 3 — For background generation, use async mode
          {!webhookUrl && (
            <span className={styles.guideHint}> (set a webhook URL when creating the app for auto-delivery)</span>
          )}
        </div>
        <CodeBlock code={asyncSnippet} id={`guide-async-${clientName}`} />
      </div>
    </div>
  );
}

// ─── Connect Wizard ───

const USE_CASES = [
  { id: "blog-hero",   label: "Blog Hero",   icon: "📝", desc: "Header images for articles and posts" },
  { id: "social-og",  label: "Social Media", icon: "📱", desc: "Open Graph and social share images" },
  { id: "ad-creative", label: "Ad Creative", icon: "🎯", desc: "Paid advertising visuals" },
  { id: "case-study",  label: "Case Study",  icon: "📊", desc: "Customer proof and success visuals" },
  { id: "icon",        label: "Icons",       icon: "⬡",  desc: "Product and feature icons" },
  { id: "infographic", label: "Infographic", icon: "📈", desc: "Data and information visuals" },
] as const;

type UseCaseId = typeof USE_CASES[number]["id"];

const CORTEX_CONTEXT: Record<UseCaseId, { headline: string; data: string[] }> = {
  "blog-hero":   { headline: "Cortex pulls your brand identity to make every blog header on-brand", data: ["Brand colors and visual style", "Company voice and tone", "Audience personas"] },
  "social-og":   { headline: "Social images are generated from your Cortex brand profile — consistent across every post", data: ["Brand color palette", "Target audience data", "Company positioning"] },
  "ad-creative": { headline: "Cortex uses your proof points and brand voice to create conversion-focused ads", data: ["Customer proof points", "Brand voice guidelines", "Competitor positioning"] },
  "case-study":  { headline: "Case study visuals are built from your Cortex company data and achievements", data: ["Company milestones and proof", "Customer success data", "Brand identity"] },
  "icon":        { headline: "Icons are generated from your Cortex brand palette and visual identity", data: ["Brand color palette", "Visual style guidelines", "Product context"] },
  "infographic": { headline: "Infographics pull your company data and brand style directly from Cortex", data: ["Company data and stats", "Brand color system", "Visual hierarchy guidelines"] },
};

interface ConnectWizardProps {
  readonly onClose: (result?: { key: string; name: string; webhookUrl?: string; purpose?: string }) => void;
  readonly authHeaders: () => Record<string, string>;
  readonly showToast: (msg: string, type: "success" | "error") => void;
}

function ConnectWizard({ onClose, authHeaders, showToast }: ConnectWizardProps) {
  const [step, setStep] = useState(0);          // 0=intro 1=name 2=key 3=webhook
  const [useCase, setUseCase] = useState<UseCaseId | "">("");
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { showToast("App name is required", "error"); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = { clientName: name.trim() };
      const rl = parseInt(rateLimit, 10);
      if (rateLimit && Number.isFinite(rl) && rl > 0) body.rateLimit = rl;
      const res = await fetch("/api/admin/keys", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setApiKey(data.apiKey);
        setClientId(data.client.clientId);
        setStep(2);
      } else {
        showToast(data.error?.message ?? "Failed to create app", "error");
      }
    } catch {
      showToast("Failed to create app", "error");
    } finally {
      setCreating(false);
    }
  }, [name, rateLimit, authHeaders, showToast]);

  const handleCopyKey = useCallback(() => {
    navigator.clipboard.writeText(apiKey).then(() => setKeyCopied(true));
  }, [apiKey]);

  const handleFinish = useCallback(async (skipWebhook = false) => {
    const webhookUrl = skipWebhook ? undefined : webhook.trim() || undefined;
    if (webhookUrl && clientId) {
      setSaving(true);
      try {
        await fetch("/api/admin/keys", {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ clientId, defaultWebhookUrl: webhookUrl }),
        });
      } catch { /* non-fatal — user can add via Edit */ } finally {
        setSaving(false);
      }
    }
    onClose({ key: apiKey, name: name.trim(), webhookUrl, purpose: useCase || undefined });
  }, [webhook, clientId, apiKey, name, useCase, authHeaders, onClose]);

  // Progress dots (shown for steps 1–3)
  const progress = step > 0 && (
    <div className={styles.wizardProgress}>
      {[1, 2, 3].map((s, i) => (
        <span key={s} className={styles.wizardProgressItem}>
          <span className={`${styles.wizardDot} ${step === s ? styles.wizardDotActive : step > s ? styles.wizardDotDone : ""}`} />
          {i < 2 && <span className={`${styles.wizardLine} ${step > s ? styles.wizardLineDone : ""}`} />}
        </span>
      ))}
    </div>
  );

  return (
    <div className={styles.wizard}>
      {progress}

      {/* Step 0 — Intro */}
      {step === 0 && (
        <div className={styles.wizardStep}>
          <div className={styles.wizardStepIcon}>🔗</div>
          <h3 className={styles.wizardTitle}>Connect an App to Orbit Image</h3>
          <p className={styles.wizardSubtitle}>Takes 3 steps. Here's what will happen:</p>
          <div className={styles.wizardIntroList}>
            <div className={styles.wizardIntroItem}>
              <span className={styles.wizardIntroNum}>1</span>
              <span>Name your app — we create it instantly</span>
            </div>
            <div className={styles.wizardIntroItem}>
              <span className={styles.wizardIntroNum}>2</span>
              <span>You get an <strong>API key</strong> — paste it into your other app so it can request images from Orbit Image</span>
            </div>
            <div className={styles.wizardIntroItem}>
              <span className={styles.wizardIntroNum}>3</span>
              <span>Optionally add a <strong>webhook URL</strong> — so Orbit Image sends the finished image back to your app automatically</span>
            </div>
          </div>
          <div className={styles.wizardActions}>
            <button className={styles.cancelBtn} onClick={() => onClose()}>Cancel</button>
            <button className={styles.submitBtn} onClick={() => setStep(1)}>Let's start →</button>
          </div>
        </div>
      )}

      {/* Step 1 — Use case & name */}
      {step === 1 && (
        <div className={styles.wizardStep}>
          <h3 className={styles.wizardTitle}>Step 1 — What will you be generating?</h3>
          <p className={styles.wizardSubtitle}>Pick a use case — Cortex will pull the right brand data for it automatically.</p>
          <div className={styles.appTypeGrid}>
            {USE_CASES.map((uc) => (
              <button
                key={uc.id}
                className={`${styles.appTypeTile} ${useCase === uc.id ? styles.appTypeTileSelected : ""}`}
                onClick={() => setUseCase(uc.id)}
              >
                <span className={styles.appTypeIcon}>{uc.icon}</span>
                <span className={styles.appTypeLabel}>{uc.label}</span>
                <span className={styles.appTypeDesc}>{uc.desc}</span>
              </button>
            ))}
          </div>
          <div className={styles.wizardFields}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>App Name *</label>
              <input
                className={styles.fieldInput}
                placeholder="e.g. Blog Platform, Marketing Dashboard"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Rate Limit <span className={styles.fieldHint}>— requests per minute (default: 60)</span></label>
              <input className={styles.fieldInput} type="number" placeholder="60" value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} />
            </div>
          </div>
          <div className={styles.wizardActions}>
            <button className={styles.cancelBtn} onClick={() => setStep(0)}>← Back</button>
            <button className={styles.submitBtn} onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create App →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — API Key */}
      {step === 2 && (
        <div className={styles.wizardStep}>
          <div className={styles.wizardStepIcon}>🔑</div>
          <h3 className={styles.wizardTitle}>Step 2 — Copy your API key</h3>
          <p className={styles.wizardSubtitle}>
            Give this key to <strong>{name}</strong>. It's how that app will talk to Orbit Image.
            This key is shown <strong>only once</strong> — copy it now.
          </p>
          <div className={styles.keyRow}>
            <code className={styles.keyCode}>{apiKey}</code>
            <button className={`${styles.copyKeyBtn} ${keyCopied ? styles.copyKeyBtnDone : ""}`} onClick={handleCopyKey}>
              {keyCopied ? "✓ Copied!" : "Copy Key"}
            </button>
          </div>
          {!keyCopied && <p className={styles.keyLockedNote}>↑ Copy the key above to continue</p>}
          <div className={styles.wizardActions}>
            <button className={styles.cancelBtn} onClick={() => onClose({ key: apiKey, name: name.trim(), purpose: useCase || undefined })}>Done later</button>
            <button className={styles.submitBtn} onClick={() => setStep(3)} disabled={!keyCopied}>
              I've saved it →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Webhook URL */}
      {step === 3 && (
        <div className={styles.wizardStep}>
          <h3 className={styles.wizardTitle}>Step 3 — Receive images back (optional)</h3>
          <p className={styles.wizardSubtitle}>
            When an image is ready, Orbit Image can automatically send it to your app.
            Skip this if you don't need it — you can always add it later via Edit.
          </p>
          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Webhook URL <span className={styles.fieldHint}>— from your other app</span></label>
            <input
              className={styles.fieldInput}
              placeholder="https://yourapp.com/webhooks/orbit"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              autoFocus
            />
          </div>
          {useCase && useCase in CORTEX_CONTEXT ? (
            <div className={styles.cortexContext}>
              <div className={styles.cortexContextHeader}>
                <span className={styles.cortexContextIcon}>🧠</span>
                <span className={styles.cortexContextHeadline}>{CORTEX_CONTEXT[useCase as UseCaseId].headline}</span>
              </div>
              <div className={styles.cortexContextData}>
                {CORTEX_CONTEXT[useCase as UseCaseId].data.map((item, i) => (
                  <div key={i} className={styles.cortexContextItem}>
                    <span className={styles.cortexContextDot} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.webhookHintsGeneric}>
              The webhook URL comes from the app you're connecting to. Look for "webhook", "endpoint", or "integration URL" in that app's settings.
            </p>
          )}
          <div className={styles.wizardActions}>
            <button className={styles.cancelBtn} onClick={() => handleFinish(true)} disabled={saving}>Skip for now</button>
            <button className={styles.submitBtn} onClick={() => handleFinish(false)} disabled={saving}>
              {saving ? "Saving…" : "Finish ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Apps Panel ───

export function AppsPanel() {
  const [clients, setClients] = useState<readonly ClientInfo[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, UsageSummary>>({});
  const [usageAvailable, setUsageAvailable] = useState<boolean | null>(null); // null = unknown, false = Postgres not configured
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [newClient, setNewClient] = useState<{ key: string; name: string; webhookUrl?: string; purpose?: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();

  const authHeaders = useCallback(() => {
    const key = getApiKey();
    return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/keys", { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch {
      showToast("Failed to load clients", "error");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, showToast]);

  // Fetch per-client usage for the current month
  const fetchUsage = useCallback(async (clientList: readonly ClientInfo[]) => {
    const active = clientList.filter((c) => c.active);
    if (active.length === 0) return;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const from = monthStart.toISOString();

    const results = await Promise.allSettled(
      active.map((c) =>
        fetch(`/api/admin/usage?clientId=${c.clientId}&from=${from}`, {
          headers: authHeaders(),
        }).then((r) => r.json()),
      ),
    );

    // Check if Postgres is configured by inspecting first result
    const firstResult = results[0];
    if (
      firstResult?.status === "fulfilled" &&
      !firstResult.value.success &&
      firstResult.value.error?.code === "NOT_CONFIGURED"
    ) {
      setUsageAvailable(false);
      return;
    }

    setUsageAvailable(true);
    const map: Record<string, UsageSummary> = {};
    results.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value.success) {
        map[active[i].clientId] = {
          totalImages: result.value.summary?.totalImages ?? 0,
          totalCostUsd: result.value.summary?.totalCostUsd ?? 0,
        };
      }
    });
    setUsageMap(map);
  }, [authHeaders]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (clients.length > 0) {
      fetchUsage(clients);
    }
  }, [clients, fetchUsage]);

  const handleWizardClose = useCallback(async (result?: { key: string; name: string; webhookUrl?: string }) => {
    setShowWizard(false);
    if (result) {
      setNewClient(result);
      showToast("App connected successfully", "success");
    }
    await fetchClients();
  }, [fetchClients, showToast]);

  const handleUpdate = useCallback((updated: ClientInfo) => {
    setClients((prev) => prev.map((c) => c.clientId === updated.clientId ? updated : c));
  }, []);

  const handleRestore = useCallback(
    async (clientId: string, clientName: string) => {
      try {
        const key = getApiKey();
        const res = await fetch("/api/admin/keys", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ clientId, active: true }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Restored "${clientName}"`, "success");
          await fetchClients();
        } else {
          showToast(data.error?.message ?? "Failed to restore", "error");
        }
      } catch {
        showToast("Failed to restore", "error");
      }
    },
    [showToast, fetchClients],
  );

  const handleRevoke = useCallback(
    async (clientId: string, clientName: string) => {
      try {
        const res = await fetch("/api/admin/keys", {
          method: "DELETE",
          headers: authHeaders(),
          body: JSON.stringify({ clientId }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Revoked key for "${clientName}"`, "success");
          await fetchClients();
        } else {
          showToast(data.error?.message ?? "Failed to revoke key", "error");
        }
      } catch {
        showToast("Failed to revoke key", "error");
      }
    },
    [authHeaders, showToast, fetchClients],
  );

  const handleDelete = useCallback(
    async (clientId: string, clientName: string) => {
      try {
        const res = await fetch("/api/admin/keys", {
          method: "DELETE",
          headers: authHeaders(),
          body: JSON.stringify({ clientId, permanent: true }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Deleted "${clientName}"`, "success");
          setClients((prev) => prev.filter((c) => c.clientId !== clientId));
        } else {
          showToast(data.error?.message ?? "Failed to delete", "error");
        }
      } catch {
        showToast("Failed to delete", "error");
      } finally {
        setConfirmDeleteId(null);
      }
    },
    [authHeaders, showToast],
  );

  const activeClients = clients.filter((c) => c.active);
  const revokedClients = clients.filter((c) => !c.active);

  return (
    <div className={styles.container}>
      {/* Integration guide — shown after creating a new key */}
      {newClient && (
        <IntegrationGuide
          apiKey={newClient.key}
          clientName={newClient.name}
          webhookUrl={newClient.webhookUrl}
          purpose={newClient.purpose}
          onDismiss={() => setNewClient(null)}
        />
      )}

      {/* Connect Wizard / Button */}
      <div className={styles.createSection}>
        {showWizard ? (
          <ConnectWizard
            onClose={handleWizardClose}
            authHeaders={authHeaders}
            showToast={showToast}
          />
        ) : (
          <button className={styles.createBtn} onClick={() => setShowWizard(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Connect New App
          </button>
        )}
      </div>

      {/* Active Apps */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Active Apps
          <span className={styles.count}>{activeClients.length}</span>
        </h3>

        {loading ? (
          <div className={styles.loading}>Loading apps...</div>
        ) : activeClients.length === 0 ? (
          <div className={styles.empty}>
            No connected apps yet. Click "Connect New App" to get started.
          </div>
        ) : (
          <div className={styles.clientList}>
            {activeClients.map((client) => (
              <ClientCard
                key={client.clientId}
                client={client}
                usage={usageMap[client.clientId]}
                usageAvailable={usageAvailable}
                onRevoke={handleRevoke}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Revoked */}
      {revokedClients.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Revoked
            <span className={styles.countMuted}>{revokedClients.length}</span>
          </h3>
          <div className={styles.clientList}>
            {revokedClients.map((client) => (
              <div key={client.clientId} className={styles.clientCardRevoked}>
                <div className={styles.clientInfo}>
                  <span className={styles.clientName}>{client.clientName}</span>
                  <span className={styles.clientMeta}>
                    Created {new Date(client.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.revokedActions}>
                  <button
                    className={styles.restoreBtn}
                    onClick={() => handleRestore(client.clientId, client.clientName)}
                  >
                    Restore
                  </button>
                  {confirmDeleteId === client.clientId ? (
                    <>
                      <span className={styles.deleteConfirmText}>Delete forever?</span>
                      <button
                        className={styles.deleteBtnConfirm}
                        onClick={() => handleDelete(client.clientId, client.clientName)}
                      >
                        Yes, delete
                      </button>
                      <button
                        className={styles.deleteBtnCancel}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setConfirmDeleteId(client.clientId)}
                    >
                      Delete
                    </button>
                  )}
                  <span className={styles.revokedBadge}>Revoked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Client Card ───

const ClientCard = memo(function ClientCard({
  client,
  usage,
  usageAvailable,
  onRevoke,
  onUpdate,
}: {
  readonly client: ClientInfo;
  readonly usage?: UsageSummary;
  readonly usageAvailable: boolean | null;
  readonly onRevoke: (id: string, name: string) => void;
  readonly onUpdate: (updated: ClientInfo) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[] | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [activeLang, setActiveLang] = useState<SnippetLang>("curl");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [replacedKey, setReplacedKey] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editWebhook, setEditWebhook] = useState(client.defaultWebhookUrl ?? "");
  const [editRateLimit, setEditRateLimit] = useState(String(client.rateLimit ?? ""));
  const [editBudget, setEditBudget] = useState(String(client.monthlyBudgetUsd ?? ""));
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const handleToggleDeliveries = useCallback(async () => {
    if (showDeliveries) { setShowDeliveries(false); return; }
    setDeliveryLoading(true);
    setShowDeliveries(true);
    try {
      const key = getApiKey();
      const res = await fetch(`/api/admin/webhook-logs?clientId=${client.clientId}&limit=20`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      if (data.success) setDeliveryLogs(data.logs);
      else if (data.error?.code === "NOT_CONFIGURED") setDeliveryLogs([]);
    } catch {
      setDeliveryLogs([]);
    } finally {
      setDeliveryLoading(false);
    }
  }, [client.clientId, showDeliveries]);

  const handleReplaceKey = useCallback(async () => {
    setReplacing(true);
    try {
      const key = getApiKey();
      const res = await fetch("/api/admin/replace-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ clientId: client.clientId }),
      });
      const data = await res.json();
      if (data.success) {
        setReplacedKey(data.apiKey);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setReplacing(false);
    }
  }, [client.clientId]);

  const handleTestWebhook = useCallback(async () => {
    setTestStatus("sending");
    setTestMessage("");
    try {
      const key = getApiKey();
      const res = await fetch("/api/admin/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ clientId: client.clientId }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus("ok");
        setTestMessage(data.message ?? "Delivered");
      } else {
        setTestStatus("fail");
        setTestMessage(data.error?.message ?? "Failed");
      }
    } catch {
      setTestStatus("fail");
      setTestMessage("Network error");
    }
    setTimeout(() => setTestStatus("idle"), 4000);
  }, [client.clientId]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    try {
      const key = getApiKey();
      const body: Record<string, unknown> = { clientId: client.clientId };
      const rl = parseInt(editRateLimit, 10);
      body.rateLimit = editRateLimit && Number.isFinite(rl) && rl > 0 ? rl : 60;
      body.defaultWebhookUrl = editWebhook.trim() || null;
      const budget = parseFloat(editBudget);
      body.monthlyBudgetUsd = editBudget && Number.isFinite(budget) && budget > 0 ? budget : null;

      const res = await fetch("/api/admin/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onUpdate(data.client);
        setEditing(false);
        showToast("Settings saved", "success");
      } else {
        showToast(data.error?.message ?? "Failed to save", "error");
      }
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }, [client.clientId, editWebhook, editRateLimit, onUpdate, showToast]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const opts = {
    baseUrl,
    apiKey: "YOUR_API_KEY",
    webhookUrl: client.defaultWebhookUrl,
  };
  const syncSnippet = getSyncSnippet(activeLang, opts);
  const asyncSnippet = getAsyncSnippet(opts);

  const LANGS: readonly { id: SnippetLang; label: string }[] = [
    { id: "curl", label: "cURL" },
    { id: "javascript", label: "JavaScript" },
    { id: "python", label: "Python" },
  ];

  return (
    <div className={styles.clientCard}>
      <div className={styles.clientHeader}>
        <div className={styles.clientInfo}>
          <span className={styles.clientName}>{client.clientName}</span>
          <span className={styles.clientId}>ID: {client.clientId}</span>
        </div>
        <span className={styles.activeBadge}>Active</span>
      </div>

      <div className={styles.clientDetails}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Created</span>
          <span className={styles.detailValue}>
            {new Date(client.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Rate Limit</span>
          <span className={styles.detailValue}>{client.rateLimit ?? 60} req/min</span>
        </div>
        {client.scopes && client.scopes.length > 0 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Brands</span>
            <span className={styles.detailValue}>{client.scopes.join(", ")}</span>
          </div>
        )}
        {client.defaultWebhookUrl && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Webhook</span>
            <span className={`${styles.detailValue} ${styles.mono}`}>
              {client.defaultWebhookUrl}
            </span>
          </div>
        )}
        {client.monthlyBudgetUsd !== undefined && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Budget</span>
            <span className={styles.detailValue}>
              ${client.monthlyBudgetUsd.toFixed(2)}/mo
            </span>
          </div>
        )}
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>This Month</span>
          <span className={styles.detailValue}>
            {usageAvailable === false
              ? <span className={styles.usageUnavailable}>Requires Postgres</span>
              : usage !== undefined
                ? `${usage.totalImages} image${usage.totalImages !== 1 ? "s" : ""} · $${usage.totalCostUsd.toFixed(2)}`
                : "—"}
          </span>
        </div>
      </div>

      {/* Replaced key banner */}
      {replacedKey && (
        <div className={styles.replacedKeyBanner}>
          <div className={styles.replacedKeyHeader}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New key issued — old key is now invalid
          </div>
          <div className={styles.keyRow}>
            <code className={styles.keyCode}>{replacedKey}</code>
            <button
              className={styles.copyKeyBtn}
              onClick={() => navigator.clipboard.writeText(replacedKey)}
            >
              Copy
            </button>
          </div>
          <button className={styles.dismissReplace} onClick={() => setReplacedKey(null)}>
            Done
          </button>
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <div className={styles.editForm}>
          <div className={styles.editGrid}>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Webhook URL</label>
              <input
                className={styles.fieldInput}
                placeholder="https://yourapp.com/webhooks/orbit"
                value={editWebhook}
                onChange={(e) => setEditWebhook(e.target.value)}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Rate Limit (req/min)</label>
              <input
                className={styles.fieldInput}
                type="number"
                placeholder="60"
                value={editRateLimit}
                onChange={(e) => setEditRateLimit(e.target.value)}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Monthly Budget (USD) <span className={styles.fieldHint}>— blocks requests when reached</span></label>
              <input
                className={styles.fieldInput}
                type="number"
                step="0.01"
                placeholder="No limit"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.editActions}>
            <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
            <button className={styles.submitBtn} onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Get Code section */}
      {showCode && (
        <div className={styles.codePanel}>
          <div className={styles.codePanelNote}>
            Replace <code>YOUR_API_KEY</code> with the key shown at creation time.
          </div>
          <div className={styles.langTabs}>
            {LANGS.map((lang) => (
              <button
                key={lang.id}
                className={`${styles.langTab} ${activeLang === lang.id ? styles.langTabActive : ""}`}
                onClick={() => setActiveLang(lang.id)}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <CodeBlock code={syncSnippet} id={`card-sync-${client.clientId}`} />
          <div className={styles.codePanelAsyncTitle}>Async + Webhook</div>
          <CodeBlock code={asyncSnippet} id={`card-async-${client.clientId}`} />
        </div>
      )}

      {/* Webhook Delivery Log */}
      {showDeliveries && (
        <div className={styles.deliveryPanel}>
          {deliveryLoading ? (
            <div className={styles.deliveryEmpty}>Loading deliveries…</div>
          ) : deliveryLogs === null || deliveryLogs.length === 0 ? (
            <div className={styles.deliveryEmpty}>
              {deliveryLogs === null ? "Requires Postgres to view delivery logs." : "No webhook deliveries recorded yet."}
            </div>
          ) : (
            <table className={styles.deliveryTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Status</th>
                  <th>HTTP</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {deliveryLogs.map((log) => (
                  <tr key={log.jobId}>
                    <td>{log.lastAttemptAt ? new Date(log.lastAttemptAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td>
                      <span className={`${styles.deliveryStatus} ${log.status === "delivered" ? styles.deliveryOk : styles.deliveryFail}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className={styles.mono}>{log.responseStatus ?? "—"}</td>
                    <td>{log.attempts}</td>
                    <td className={styles.deliveryError}>{log.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className={styles.clientActions}>
        <button
          className={`${styles.getCodeBtn} ${showCode ? styles.getCodeBtnActive : ""}`}
          onClick={() => setShowCode((v) => !v)}
        >
          {showCode ? "Hide Code" : "Get Code"}
        </button>

        <button
          className={`${styles.editBtn} ${editing ? styles.editBtnActive : ""}`}
          onClick={() => {
            setEditWebhook(client.defaultWebhookUrl ?? "");
            setEditRateLimit(String(client.rateLimit ?? ""));
            setEditBudget(String(client.monthlyBudgetUsd ?? ""));
            setEditing((v) => !v);
          }}
        >
          Edit
        </button>

        {client.defaultWebhookUrl && (
          <div className={styles.testWebhookGroup}>
            <button
              className={`${styles.testWebhookBtn} ${testStatus === "ok" ? styles.testOk : testStatus === "fail" ? styles.testFail : ""}`}
              onClick={handleTestWebhook}
              disabled={testStatus === "sending"}
            >
              {testStatus === "sending" ? "Sending…" : testStatus === "ok" ? "✓ Delivered" : testStatus === "fail" ? "✗ Failed" : "Test Webhook"}
            </button>
            {testMessage && testStatus !== "idle" && (
              <span className={styles.testMsg}>{testMessage}</span>
            )}
          </div>
        )}

        {client.defaultWebhookUrl && (
          <button
            className={`${styles.deliveryLogBtn} ${showDeliveries ? styles.deliveryLogBtnActive : ""}`}
            onClick={handleToggleDeliveries}
          >
            {showDeliveries ? "Hide Log" : "Delivery Log"}
          </button>
        )}

        <button
          className={styles.replaceKeyBtn}
          onClick={handleReplaceKey}
          disabled={replacing}
          title="Issue a new API key and invalidate the current one"
        >
          {replacing ? "Replacing…" : "Replace Key"}
        </button>

        <div className={styles.actionsSpacer} />

        {confirming ? (
          <>
            <span className={styles.confirmText}>Revoke this key?</span>
            <button className={styles.confirmYes} onClick={() => onRevoke(client.clientId, client.clientName)}>
              Yes, Revoke
            </button>
            <button className={styles.confirmNo} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={styles.revokeBtn} onClick={() => setConfirming(true)}>
            Revoke Key
          </button>
        )}
      </div>
    </div>
  );
});
