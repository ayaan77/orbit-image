"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import styles from "../page.module.css";

interface WorkspaceMember {
  readonly id: string;
  readonly username: string;
  readonly role: string;
}

interface WorkspaceRow {
  readonly id: string;
  readonly brandId: string;
  readonly name: string;
  readonly slug: string;
  readonly createdAt: string;
  readonly memberCount?: number;
}

function ChatBubblesIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
    >
      <path d="M3 3h10a1 1 0 011 1v6a1 1 0 01-1 1H7l-4 3V4a1 1 0 011-1z" />
    </svg>
  );
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceRow[]>([]);
  const [members, setMembers] = useState<Record<string, readonly WorkspaceMember[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/chat/workspaces");
      if (res.ok) {
        const data = await res.json();
        const list: WorkspaceRow[] = Array.isArray(data)
          ? data
          : (data.workspaces ?? []);
        setWorkspaces(list);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const fetchMembers = useCallback(async (workspaceId: string) => {
    try {
      const res = await apiFetch(
        `/api/chat/workspaces/${workspaceId}/members?q=`
      );
      if (res.ok) {
        const data = await res.json();
        const list: WorkspaceMember[] = Array.isArray(data)
          ? data
          : (data.members ?? []);
        setMembers((prev) => ({ ...prev, [workspaceId]: list }));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleExpanded = useCallback(
    (workspaceId: string) => {
      setExpanded((prev) => {
        const next = { ...prev, [workspaceId]: !prev[workspaceId] };
        if (next[workspaceId] && !members[workspaceId]) {
          fetchMembers(workspaceId);
        }
        return next;
      });
    },
    [members, fetchMembers]
  );

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await apiFetch("/api/chat/workspaces/sync", {
        method: "POST",
      });
      if (res.ok) {
        setSyncMsg("Workspaces synced successfully.");
        await fetchWorkspaces();
      } else {
        const data = await res.json();
        setSyncMsg(data.error ?? "Sync failed.");
      }
    } catch {
      setSyncMsg("Network error during sync.");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [fetchWorkspaces]);

  const handleAddMember = useCallback(
    async (workspaceId: string) => {
      const username = addUsername.trim();
      if (!username) return;

      setAddError(null);
      try {
        const res = await apiFetch(
          `/api/chat/workspaces/${workspaceId}/members`,
          {
            method: "POST",
            body: JSON.stringify({ username }),
          }
        );
        if (res.ok) {
          setAddingTo(null);
          setAddUsername("");
          await fetchMembers(workspaceId);
        } else {
          const data = await res.json();
          setAddError(data.error ?? "Failed to add member.");
        }
      } catch {
        setAddError("Network error.");
      }
    },
    [addUsername, fetchMembers]
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Workspaces</h1>
      <p className={styles.subtitle}>
        Chat workspaces linked to Cortex brands. Use Sync to pull brands from
        Cortex and create workspaces with default channels.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            padding: "8px 16px",
            background: syncing ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.85)",
            color: "#e0e7ff",
            border: "none",
            borderRadius: 8,
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: syncing ? "not-allowed" : "pointer",
            transition: "background 0.15s ease",
          }}
          type="button"
        >
          {syncing ? "Syncing…" : "Sync from Cortex"}
        </button>
        {syncMsg && (
          <span
            style={{
              fontSize: "0.75rem",
              color: syncMsg.includes("success") ? "#34d399" : "#f87171",
            }}
          >
            {syncMsg}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Loading workspaces…
        </div>
      ) : workspaces.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            background: "var(--bg-card)",
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.1)",
          }}
        >
          <ChatBubblesIcon />
          <p style={{ marginTop: 12 }}>
            No workspaces found. Click Sync to create workspaces from connected
            brands.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              members={members[ws.id]}
              isExpanded={expanded[ws.id] ?? false}
              onToggle={() => toggleExpanded(ws.id)}
              onAddMemberClick={() => {
                setAddingTo(ws.id);
                setAddUsername("");
                setAddError(null);
              }}
              isAddingMember={addingTo === ws.id}
              addUsername={addUsername}
              onAddUsernameChange={setAddUsername}
              onAddSubmit={() => handleAddMember(ws.id)}
              onAddCancel={() => {
                setAddingTo(null);
                setAddError(null);
              }}
              addError={addError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WorkspaceCardProps {
  readonly workspace: WorkspaceRow;
  readonly members?: readonly WorkspaceMember[];
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly onAddMemberClick: () => void;
  readonly isAddingMember: boolean;
  readonly addUsername: string;
  readonly onAddUsernameChange: (v: string) => void;
  readonly onAddSubmit: () => void;
  readonly onAddCancel: () => void;
  readonly addError: string | null;
}

function WorkspaceCard({
  workspace,
  members,
  isExpanded,
  onToggle,
  onAddMemberClick,
  isAddingMember,
  addUsername,
  onAddUsernameChange,
  onAddSubmit,
  onAddCancel,
  addError,
}: WorkspaceCardProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        transition: "border-color 0.15s ease",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "rgba(99,102,241,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#818cf8",
              fontWeight: 700,
              fontSize: "0.875rem",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {workspace.name.charAt(0)}
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.9375rem",
                color: "var(--text-primary)",
              }}
            >
              {workspace.name}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              Brand: <code style={{ fontSize: "0.6875rem" }}>{workspace.brandId}</code>
              {members !== undefined && (
                <span style={{ marginLeft: 10 }}>
                  {members.length} member{members.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onAddMemberClick}
            style={{
              padding: "5px 10px",
              background: "rgba(52,211,153,0.12)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: 6,
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
            type="button"
          >
            + Add Member
          </button>
          <button
            onClick={onToggle}
            style={{
              padding: "5px 10px",
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
            type="button"
          >
            {isExpanded ? "Hide Members" : "Show Members"}
          </button>
        </div>
      </div>

      {/* Add member form */}
      {isAddingMember && (
        <div
          style={{
            padding: "10px 18px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(52,211,153,0.04)",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#34d399", marginBottom: 8 }}>
            Add member to {workspace.name}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={addUsername}
              onChange={(e) => onAddUsernameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAddSubmit();
                if (e.key === "Escape") onAddCancel();
              }}
              placeholder="Username or email"
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: "0.8125rem",
                outline: "none",
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            <button
              onClick={onAddSubmit}
              disabled={!addUsername.trim()}
              style={{
                padding: "6px 12px",
                background: addUsername.trim() ? "rgba(52,211,153,0.8)" : "rgba(52,211,153,0.3)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: addUsername.trim() ? "pointer" : "not-allowed",
              }}
              type="button"
            >
              Add
            </button>
            <button
              onClick={onAddCancel}
              style={{
                padding: "6px 10px",
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
          {addError && (
            <div style={{ marginTop: 6, fontSize: "0.75rem", color: "#f87171" }}>
              {addError}
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      {isExpanded && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 18px 14px",
          }}
        >
          {members === undefined ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
              No members yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "5px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(99,102,241,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#818cf8",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      flexShrink: 0,
                    }}
                  >
                    {member.username.charAt(0)}
                  </div>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-primary)",
                      flex: 1,
                    }}
                  >
                    {member.username}
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--text-muted)",
                      background: "rgba(255,255,255,0.06)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "capitalize",
                    }}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
