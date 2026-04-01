"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import type { ImageShareData, Workspace, Channel } from "@/lib/chat/types";
import styles from "./ChannelPickerModal.module.css";

interface ChannelPickerModalProps {
  onClose: () => void;
  imageData: ImageShareData;
}

export function ChannelPickerModal({ onClose, imageData }: ChannelPickerModalProps) {
  const [channels, setChannels] = useState<readonly Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [loadingChannels, setLoadingChannels] = useState(true);
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

        const results = await Promise.all(
          workspaces.map(async (ws) => {
            try {
              const chRes = await apiFetch(
                `/api/chat/workspaces/${ws.id}/channels`
              );
              if (!chRes.ok) return [] as Channel[];
              const chData = await chRes.json();
              return (Array.isArray(chData) ? chData : (chData.channels ?? [])) as Channel[];
            } catch {
              return [] as Channel[];
            }
          })
        );
        const allChannels = results.flat();

        if (!cancelled) {
          setChannels(allChannels);
          if (allChannels.length > 0) {
            setSelectedChannelId(allChannels[0].id);
          }
          setLoadingChannels(false);
        }
      } catch {
        // Network error — modal stays empty
        if (!cancelled) {
          setLoadingChannels(false);
        }
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
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <h3 className={styles.title}>Share to Channel</h3>

        {loadingChannels ? (
          <p className={styles.loadingText}>Loading channels…</p>
        ) : channels.length === 0 ? (
          <p className={styles.emptyText}>
            No channels available. Ask an admin to create channels in your workspace.
          </p>
        ) : (
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            className={styles.select}
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
          maxLength={500}
          className={styles.textarea}
        />

        {error && (
          <p className={styles.errorText}>{error}</p>
        )}

        <div className={styles.actions}>
          <button
            onClick={onClose}
            type="button"
            className={styles.cancelBtn}
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={isPosting || !selectedChannelId}
            type="button"
            className={styles.postBtn}
          >
            {isPosting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
