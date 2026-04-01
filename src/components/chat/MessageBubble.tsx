"use client";

import { Fragment, type ReactNode } from "react";
import { ReactionBar } from "./ReactionBar";
import { ThreadPreview } from "./ThreadPreview";
import type { Message } from "@/lib/chat/types";
import { formatTimeAgo } from "@/lib/chat/utils";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
  readonly message: Message;
  readonly onOpenThread: (messageId: string) => void;
  readonly onDelete: (messageId: string) => void;
  readonly currentUserId?: string;
}

export function MessageBubble({
  message,
  onOpenThread,
  onDelete,
  currentUserId,
}: MessageBubbleProps) {
  const isDeleted = message.deletedAt !== null;
  const isAuthor = currentUserId ? message.userId === currentUserId : false;
  const initial = message.username.charAt(0).toUpperCase();

  return (
    <div className={styles.bubble} data-testid="message-bubble">
      <div className={styles.avatar}>{initial}</div>

      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.username}>{message.username}</span>
          <span className={styles.timestamp}>{formatTimeAgo(message.createdAt)}</span>
        </div>

        {isDeleted ? (
          <span className={styles.deleted} data-testid="deleted-message">
            (message deleted)
          </span>
        ) : (
          <>
            <div className={styles.content}>
              {highlightMentions(message.content)}
            </div>

            <ReactionBar
              messageId={message.id}
              reactions={message.reactions ?? []}
            />

            {(message.replyCount ?? 0) > 0 && (
              <ThreadPreview
                messageId={message.id}
                replyCount={message.replyCount ?? 0}
                onOpenThread={onOpenThread}
              />
            )}
          </>
        )}
      </div>

      {isAuthor && !isDeleted && (
        <button
          className={styles.deleteBtn}
          onClick={() => onDelete(message.id)}
          aria-label="Delete message"
          type="button"
        >
          <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
            <path
              d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function highlightMentions(content: string): ReactNode {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className={styles.mention} data-testid="mention">
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

