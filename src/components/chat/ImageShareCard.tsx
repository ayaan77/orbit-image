"use client";

import { useState, useCallback } from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import { ReactionBar } from "./ReactionBar";
import { ThreadPreview } from "./ThreadPreview";
import type { Message } from "@/lib/chat/types";
import styles from "./ImageShareCard.module.css";

interface ImageShareCardProps {
  readonly message: Message;
  readonly onOpenThread: (messageId: string) => void;
  readonly currentUserId?: string;
  readonly isAdmin?: boolean;
}

export function ImageShareCard({
  message,
  onOpenThread,
  currentUserId,
  isAdmin,
}: ImageShareCardProps) {
  const { openStudioWithContext } = useChatContext();
  const [expanded, setExpanded] = useState(false);
  const imageData = message.imageData;
  const isAuthor = currentUserId ? message.userId === currentUserId : false;
  const initial = message.username.charAt(0).toUpperCase();

  const handleRegenerate = useCallback(async () => {
    if (!imageData) return;

    // Fetch thread replies to build feedback summary
    let feedbackSummary = "";
    try {
      const res = await apiFetch(`/api/chat/messages/${message.id}/thread`);
      if (res.ok) {
        const data = await res.json();
        const replies: Message[] = Array.isArray(data)
          ? data
          : (data.messages ?? []);
        feedbackSummary = replies
          .filter((r) => r.content && !r.deletedAt)
          .map((r) => r.content)
          .join("\n");
      }
    } catch {
      // Continue without feedback
    }

    openStudioWithContext({
      prompt: imageData.prompt,
      model: imageData.model,
      brand: imageData.brand,
      feedback: feedbackSummary || undefined,
    });
  }, [imageData, message.id, openStudioWithContext]);

  if (!imageData) return null;

  const formatTimeAgo = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  return (
    <div className={styles.card} data-testid="image-share-card">
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.avatar}>{initial}</div>
        <span className={styles.username}>{message.username}</span>
        <span className={styles.timestamp}>
          {formatTimeAgo(message.createdAt)}
        </span>
      </div>

      {/* Image */}
      <div className={styles.imageWrapper}>
        <img
          className={styles.image}
          src={imageData.imageUrl}
          alt={`Generated image: ${imageData.prompt.slice(0, 80)}`}
          loading="lazy"
        />
      </div>

      {/* Badges */}
      <div className={styles.badges}>
        <span className={`${styles.badge} ${styles.brandBadge}`}>
          {imageData.brand}
        </span>
        <span className={`${styles.badge} ${styles.modelBadge}`}>
          {imageData.model}
        </span>
      </div>

      {/* Prompt */}
      <div
        className={`${styles.prompt} ${!expanded ? styles.promptClamped : ""}`}
      >
        {imageData.prompt}
      </div>
      {imageData.prompt.length > 100 && (
        <button
          className={styles.showMore}
          onClick={() => setExpanded((prev) => !prev)}
          type="button"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Reactions */}
      <ReactionBar
        messageId={message.id}
        reactions={message.reactions ?? []}
      />

      {/* Thread */}
      {(message.replyCount ?? 0) > 0 && (
        <ThreadPreview
          messageId={message.id}
          replyCount={message.replyCount ?? 0}
          onOpenThread={onOpenThread}
        />
      )}

      {/* Regenerate button — shown to author or admin */}
      {/* TODO: pass real isAdmin value once workspace role is available from context */}
      {(isAuthor || isAdmin) && (
        <button
          className={styles.regenerateBtn}
          onClick={handleRegenerate}
          type="button"
          data-testid="regenerate-btn"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Regenerate with feedback
        </button>
      )}
    </div>
  );
}
