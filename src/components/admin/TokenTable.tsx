"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import styles from "./TokenTable.module.css";

interface McpToken {
  readonly id: string;
  readonly name: string;
  readonly createdBy: string;
  readonly active: boolean;
  readonly rateLimit?: number;
  readonly scopes?: readonly string[];
  readonly createdAt: string;
}

interface CreateTokenForm {
  name: string;
  rateLimit: string;
  scopes: string;
}

interface CreatedToken {
  readonly apiKey: string;
  readonly mcpUrl: string;
}

const EMPTY_FORM: CreateTokenForm = {
  name: "",
  rateLimit: "60",
  scopes: "",
};

export function TokenTable() {
  const { showToast } = useToast();
  const [tokens, setTokens] = useState<readonly McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTokenForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const limit = 20;

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      const res = await apiFetch(`/api/admin/tokens?offset=${offset}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch tokens");
      const data = await res.json();
      setTokens(data.tokens ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load tokens";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function handleCreate() {
    if (!createForm.name) {
      showToast("Token name is required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const scopesList = createForm.scopes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiFetch("/api/admin/tokens", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          rateLimit: createForm.rateLimit ? Number(createForm.rateLimit) : undefined,
          scopes: scopesList.length > 0 ? scopesList : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Create failed");
      }
      const data = await res.json();
      const apiKey = data.apiKey ?? "";
      const mcpUrl = data.mcpUrl ?? `${window.location.origin}/api/mcp`;
      setCreated({ apiKey, mcpUrl });
      setCreateForm(EMPTY_FORM);
      showToast("Token created -- save the key now, it won't be shown again", "success", 6000);
      fetchTokens();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Create failed";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(tokenId: string, tokenName: string) {
    if (!confirm(`Revoke token "${tokenName}"? It will become inactive.`)) return;
    try {
      const res = await apiFetch("/api/admin/tokens", {
        method: "PATCH",
        body: JSON.stringify({ tokenId, active: false }),
      });
      if (!res.ok) throw new Error("Revoke failed");
      showToast("Token revoked", "success");
      fetchTokens();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Revoke failed";
      showToast(message, "error");
    }
  }

  async function handleDelete(tokenId: string, tokenName: string) {
    if (!confirm(`Permanently delete token "${tokenName}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch("/api/admin/tokens", {
        method: "DELETE",
        body: JSON.stringify({ tokenId, permanent: true }),
      });
      if (!res.ok) throw new Error("Delete failed");
      showToast("Token deleted", "success");
      fetchTokens();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      showToast(message, "error");
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied to clipboard`, "success"),
      () => showToast("Failed to copy", "error"),
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (loading) return <div className={styles.loading}>Loading tokens...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => {
            setShowCreate(!showCreate);
            setCreated(null);
          }}
        >
          {showCreate ? "Cancel" : "+ Create Token"}
        </button>
      </div>

      {showCreate && (
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Name *</label>
            <input
              className={styles.formInput}
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="my-mcp-token"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Rate Limit (req/min)</label>
            <input
              className={styles.formInput}
              type="number"
              value={createForm.rateLimit}
              onChange={(e) => setCreateForm({ ...createForm, rateLimit: e.target.value })}
              placeholder="60"
            />
          </div>
          <div className={`${styles.formGroup} ${styles.formFull}`}>
            <label className={styles.formLabel}>Scopes (comma-separated)</label>
            <input
              className={styles.formInput}
              value={createForm.scopes}
              onChange={(e) => setCreateForm({ ...createForm, scopes: e.target.value })}
              placeholder="generate, brands, health"
            />
            <span className={styles.formHint}>Leave empty for all scopes</span>
          </div>
          <div className={styles.formActions}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Token"}
            </button>
          </div>
        </div>
      )}

      {created && (
        <div className={styles.createdBox}>
          <div>
            <span className={styles.createdLabel}>API Key</span>
            <div className={styles.createdValue}>{created.apiKey}</div>
          </div>
          <div>
            <span className={styles.createdLabel}>MCP URL</span>
            <div className={styles.createdValue}>{created.mcpUrl}</div>
          </div>
          <div className={styles.createdActions}>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => copyToClipboard(created.apiKey, "API Key")}
            >
              Copy API Key
            </button>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => copyToClipboard(created.mcpUrl, "MCP URL")}
            >
              Copy MCP URL
            </button>
          </div>
          <span className={styles.createdWarning}>
            Save these now. The API key will not be shown again.
          </span>
        </div>
      )}

      {tokens.length === 0 ? (
        <div className={styles.empty}>No tokens found</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Created By</th>
                <th>Active</th>
                <th>Rate Limit</th>
                <th>Scopes</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td>{token.name}</td>
                  <td>{token.createdBy}</td>
                  <td>
                    <span className={`${styles.badge} ${token.active ? styles.badgeActive : styles.badgeInactive}`}>
                      {token.active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td>{token.rateLimit ?? "--"}</td>
                  <td>
                    <div className={styles.scopeList}>
                      {token.scopes && token.scopes.length > 0 ? (
                        token.scopes.map((scope) => (
                          <span key={scope} className={styles.scopeTag}>
                            {scope}
                          </span>
                        ))
                      ) : (
                        <span className={styles.scopeTag}>all</span>
                      )}
                    </div>
                  </td>
                  <td>{new Date(token.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.actions}>
                      {token.active && (
                        <button
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
                          onClick={() => handleRevoke(token.id, token.name)}
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => handleDelete(token.id, token.name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
