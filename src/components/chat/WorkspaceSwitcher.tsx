"use client";

import { useEffect, useState } from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import type { Workspace } from "@/lib/chat/types";
import styles from "./ChatPanel.module.css";

export function WorkspaceSwitcher() {
  const { activeWorkspaceId, setActiveWorkspace } = useChatContext();
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorkspaces() {
      try {
        const res = await apiFetch("/api/chat/workspaces");
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list: Workspace[] = Array.isArray(data)
            ? data
            : (data.workspaces ?? []);
          setWorkspaces(list);
        }
      } catch {
        // Network error — workspaces stay empty
      }
    }

    fetchWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  if (workspaces.length === 0) return null;

  return (
    <div className={styles.workspaceSwitcher} data-testid="workspace-switcher">
      {workspaces.map((ws) => {
        const initial = ws.name.charAt(0).toUpperCase();
        const isActive = ws.id === activeWorkspaceId;
        const className = isActive
          ? `${styles.workspacePill} ${styles.workspacePillActive}`
          : styles.workspacePill;

        return (
          <button
            key={ws.id}
            className={className}
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
