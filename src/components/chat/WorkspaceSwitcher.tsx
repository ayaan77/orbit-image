"use client";

import { useEffect, useState } from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import type { Workspace } from "@/lib/chat/types";
import styles from "./ChatPanel.module.css";

/** Generate a stable color index from a workspace name string (0–7). */
function colorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return hash % 8;
}

const PILL_BG = [
  '#3730a3', // indigo
  '#0369a1', // sky blue
  '#065f46', // emerald
  '#92400e', // amber
  '#7c3aed', // violet
  '#be185d', // pink
  '#0f766e', // teal
  '#1f2937', // slate
];

const PILL_ACTIVE_BG = [
  '#4f46e5',
  '#0284c7',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#374151',
];

export function WorkspaceSwitcher() {
  const { activeWorkspaceId, setActiveWorkspace } = useChatContext();
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorkspaces() {
      setLoading(true);
      try {
        const res = await apiFetch("/api/chat/workspaces");
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list: Workspace[] = Array.isArray(data)
            ? data
            : (data.workspaces ?? []);
          setWorkspaces(list);
        } else if (!cancelled) {
          setError("Failed to load workspaces");
        }
      } catch {
        if (!cancelled) setError("Failed to load workspaces");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className={styles.error}>{error}</div>;
  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (workspaces.length === 0) return null;

  return (
    <div className={styles.workspaceSwitcher} data-testid="workspace-switcher">
      {workspaces.map((ws) => {
        const initial = ws.name.charAt(0).toUpperCase();
        const isActive = ws.id === activeWorkspaceId;
        const idx = colorIndex(ws.name);
        const bgColor = isActive ? PILL_ACTIVE_BG[idx] : PILL_BG[idx];
        const borderColor = isActive ? PILL_ACTIVE_BG[idx] : 'transparent';

        return (
          <button
            key={ws.id}
            style={{ background: bgColor, borderColor }}
            className={isActive ? `${styles.workspacePill} ${styles.workspacePillActive}` : styles.workspacePill}
            onClick={() => setActiveWorkspace(ws.id)}
            aria-label={`Switch to workspace ${ws.name}`}
            title={ws.name}
            type="button"
          >
            {initial}
          </button>
        );
      })}
    </div>
  );
}
