"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { getApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import styles from "./AppsPanel.module.css";

interface ClientInfo {
  readonly clientId: string;
  readonly clientName: string;
  readonly createdAt: string;
  readonly active: boolean;
  readonly rateLimit?: number;
  readonly scopes?: readonly string[];
  readonly defaultWebhookUrl?: string;
}

export function AppsPanel() {
  const [clients, setClients] = useState<readonly ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formRateLimit, setFormRateLimit] = useState("");
  const [formScopes, setFormScopes] = useState("");
  const [formWebhook, setFormWebhook] = useState("");
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const { showToast } = useToast();

  const headers = useCallback(() => {
    const key = getApiKey();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/keys", { headers: headers() });
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch {
      showToast("Failed to load clients", "error");
    } finally {
      setLoading(false);
    }
  }, [headers, showToast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) {
      showToast("Client name is required", "error");
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = { clientName: formName.trim() };

      const rl = parseInt(formRateLimit, 10);
      if (formRateLimit && Number.isFinite(rl) && rl > 0) {
        body.rateLimit = rl;
      }
      if (formScopes.trim()) {
        body.scopes = formScopes.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (formWebhook.trim()) {
        body.defaultWebhookUrl = formWebhook.trim();
      }

      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setNewKeyResult(data.apiKey);
        setFormName("");
        setFormRateLimit("");
        setFormScopes("");
        setFormWebhook("");
        showToast("Client created successfully", "success");
        await fetchClients();
      } else {
        showToast(data.error?.message ?? "Failed to create client", "error");
      }
    } catch {
      showToast("Failed to create client", "error");
    } finally {
      setCreating(false);
    }
  }, [formName, formRateLimit, formScopes, formWebhook, headers, showToast, fetchClients]);

  const handleRevoke = useCallback(
    async (clientId: string, clientName: string) => {
      try {
        const res = await fetch("/api/admin/keys", {
          method: "DELETE",
          headers: headers(),
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
    [headers, showToast, fetchClients],
  );

  const handleCopyKey = useCallback(
    (key: string) => {
      navigator.clipboard.writeText(key).then(() => {
        showToast("API key copied — store it securely, it won't be shown again", "info");
      });
    },
    [showToast],
  );

  const activeClients = clients.filter((c) => c.active);
  const revokedClients = clients.filter((c) => !c.active);

  return (
    <div className={styles.container}>
      {/* New Key Result Banner */}
      {newKeyResult && (
        <div className={styles.keyBanner}>
          <div className={styles.keyBannerHeader}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>New API Key Created</span>
          </div>
          <p className={styles.keyBannerText}>
            Copy this key now. It will not be shown again.
          </p>
          <div className={styles.keyBannerValue}>
            <code>{newKeyResult}</code>
            <button
              className={styles.copyKeyBtn}
              onClick={() => handleCopyKey(newKeyResult)}
            >
              Copy
            </button>
          </div>
          <button
            className={styles.dismissBanner}
            onClick={() => setNewKeyResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create New Client */}
      <div className={styles.createSection}>
        {!showForm ? (
          <button className={styles.createBtn} onClick={() => setShowForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Connect New App
          </button>
        ) : (
          <div className={styles.createForm}>
            <h3 className={styles.formTitle}>New API Client</h3>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Client Name *</label>
                <input
                  className={styles.fieldInput}
                  placeholder="e.g. Marketing Dashboard"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Rate Limit (req/min)</label>
                <input
                  className={styles.fieldInput}
                  type="number"
                  placeholder="Default: 60"
                  value={formRateLimit}
                  onChange={(e) => setFormRateLimit(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Brand Scopes</label>
                <input
                  className={styles.fieldInput}
                  placeholder="e.g. apexure, brand2 (comma separated)"
                  value={formScopes}
                  onChange={(e) => setFormScopes(e.target.value)}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>Default Webhook URL</label>
                <input
                  className={styles.fieldInput}
                  placeholder="https://yourapp.com/webhooks/orbit"
                  value={formWebhook}
                  onChange={(e) => setFormWebhook(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setShowForm(false);
                  setFormName("");
                  setFormRateLimit("");
                  setFormScopes("");
                  setFormWebhook("");
                }}
              >
                Cancel
              </button>
              <button
                className={styles.submitBtn}
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create API Key"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Clients */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          Active Apps
          <span className={styles.count}>{activeClients.length}</span>
        </h3>

        {loading ? (
          <div className={styles.loading}>Loading clients...</div>
        ) : activeClients.length === 0 ? (
          <div className={styles.empty}>
            No connected apps yet. Create your first API key above.
          </div>
        ) : (
          <div className={styles.clientList}>
            {activeClients.map((client) => (
              <ClientCard
                key={client.clientId}
                client={client}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}
      </div>

      {/* Revoked Clients */}
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
                <span className={styles.revokedBadge}>Revoked</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ClientCard = memo(function ClientCard({
  client,
  onRevoke,
}: {
  readonly client: ClientInfo;
  readonly onRevoke: (id: string, name: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

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
          <span className={styles.detailValue}>
            {client.rateLimit ?? 60} req/min
          </span>
        </div>
        {client.scopes && client.scopes.length > 0 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Brands</span>
            <span className={styles.detailValue}>
              {client.scopes.join(", ")}
            </span>
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
      </div>

      <div className={styles.clientActions}>
        {confirming ? (
          <>
            <span className={styles.confirmText}>Revoke this key?</span>
            <button
              className={styles.confirmYes}
              onClick={() => onRevoke(client.clientId, client.clientName)}
            >
              Yes, Revoke
            </button>
            <button
              className={styles.confirmNo}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className={styles.revokeBtn}
            onClick={() => setConfirming(true)}
          >
            Revoke Key
          </button>
        )}
      </div>
    </div>
  );
});
