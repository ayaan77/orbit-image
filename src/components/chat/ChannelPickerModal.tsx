"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import type { ImageShareData, Workspace, Channel } from "@/lib/chat/types";

interface ChannelPickerModalProps {
  onClose: () => void;
  imageData: ImageShareData;
}

export function ChannelPickerModal({ onClose, imageData }: ChannelPickerModalProps) {
  const [channels, setChannels] = useState<readonly Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch workspaces then channels on mount
  useEffect(() => {
    let cancelled = false;

    async function loadChannels() {
      try {
        const wsRes = await apiFetch("/api/chat/workspaces");
        if (!wsRes.ok) return;
        const wsData = await wsRes.json();
        const workspaces: Workspace[] = Array.isArray(wsData)
          ? wsData
          : (wsData.workspaces ?? []);

        const allChannels: Channel[] = [];
        await Promise.all(
          workspaces.map(async (ws) => {
            try {
              const chRes = await apiFetch(
                `/api/chat/workspaces/${ws.id}/channels`
              );
              if (chRes.ok) {
                const chData = await chRes.json();
                const list: Channel[] = Array.isArray(chData)
                  ? chData
                  : (chData.channels ?? []);
                allChannels.push(...list);
              }
            } catch {
              // Skip workspace on error
            }
          })
        );

        if (!cancelled) {
          setChannels(allChannels);
          if (allChannels.length > 0) {
            setSelectedChannelId(allChannels[0].id);
          }
        }
      } catch {
        // Network error — modal stays empty
      }
    }

    loadChannels();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePost = useCallback(async () => {
    if (!selectedChannelId) return;
    setIsPosting(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/api/chat/channels/${selectedChannelId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            type: "image_share",
            content: caption,
            imageData,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to post image.");
        return;
      }

      onClose();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsPosting(false);
    }
  }, [selectedChannelId, caption, imageData, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#1e1f2e",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "12px",
          padding: "24px",
          width: "360px",
          maxWidth: "calc(100vw - 32px)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#e0e7ff" }}>
          Share to Channel
        </h3>

        {channels.length === 0 ? (
          <p style={{ color: "#818cf8", fontSize: "0.875rem", margin: 0 }}>
            Loading channels…
          </p>
        ) : (
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "6px",
              color: "#e0e7ff",
              padding: "8px 10px",
              fontSize: "0.875rem",
              width: "100%",
            }}
          >
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.isDm ? ch.name : `# ${ch.name}`}
              </option>
            ))}
          </select>
        )}

        <textarea
          placeholder="Add a caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "6px",
            color: "#e0e7ff",
            padding: "8px 10px",
            fontSize: "0.875rem",
            width: "100%",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "#f87171", fontSize: "0.8125rem", margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            type="button"
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={isPosting || !selectedChannelId}
            type="button"
            style={{
              padding: "8px 16px",
              background: isPosting ? "rgba(99,102,241,0.5)" : "#6366f1",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              cursor: isPosting ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {isPosting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
