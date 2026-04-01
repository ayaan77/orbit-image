"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import type { Message } from "@/lib/chat/types";
import styles from "./MessagePane.module.css";

interface ThreadPaneProps {
  readonly parentId: string;
  readonly onClose: () => void;
}

export function ThreadPane({ parentId, onClose }: ThreadPaneProps) {
  const [parentMessage, setParentMessage] = useState<Message | null>(null);
  const [replies, setReplies] = useState<readonly Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchThread() {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/api/chat/messages/${parentId}/thread`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.parent) {
            setParentMessage(data.parent);
          }
          const replyList: Message[] = Array.isArray(data)
            ? data
            : (data.messages ?? data.replies ?? []);
          setReplies(replyList);
        }
      } catch {
        // Network error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchThread();
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  const handleReplySent = useCallback((msg: Message) => {
    setReplies((prev) => [...prev, msg]);
  }, []);

  const handleDeleteReply = useCallback(async (messageId: string) => {
    try {
      const res = await apiFetch(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReplies((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, deletedAt: new Date().toISOString() }
              : msg
          )
        );
      }
    } catch {
      // Network error
    }
  }, []);

  return (
    <div className={styles.threadOverlay} data-testid="thread-pane">
      {/* Header */}
      <div className={styles.threadHeader}>
        <span className={styles.threadTitle}>Thread</span>
        <button
          className={styles.threadCloseBtn}
          onClick={onClose}
          aria-label="Close thread"
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path
              d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Thread body */}
      <div className={styles.threadBody}>
        {isLoading ? (
          <div style={{ color: "#818cf8", fontSize: "0.8125rem", textAlign: "center", padding: "24px" }}>
            Loading thread...
          </div>
        ) : (
          <>
            {/* Parent message */}
            {parentMessage && (
              <div className={styles.threadParent}>
                <MessageBubble
                  message={parentMessage}
                  onOpenThread={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}

            {/* Replies */}
            {replies.map((reply) => (
              <MessageBubble
                key={reply.id}
                message={reply}
                onOpenThread={() => {}}
                onDelete={handleDeleteReply}
              />
            ))}

            {replies.length === 0 && !isLoading && (
              <div style={{ color: "#818cf8", fontSize: "0.75rem", textAlign: "center", padding: "16px" }}>
                No replies yet
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer for thread replies */}
      <MessageComposer
        channelId=""
        parentId={parentId}
        onSent={handleReplySent}
      />
    </div>
  );
}
