"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { ImageShareCard } from "./ImageShareCard";
import type { Message } from "@/lib/chat/types";
import styles from "./MessageList.module.css";

interface MessageListProps {
  readonly messages: readonly Message[];
  readonly hasMore: boolean;
  readonly onLoadMore: () => void;
  readonly onOpenThread: (messageId: string) => void;
  readonly onDeleteMessage: (messageId: string) => void;
}

export function MessageList({
  messages,
  hasMore,
  onLoadMore,
  onOpenThread,
  onDeleteMessage,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages (not when loading older messages)
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  return (
    <div className={styles.container} data-testid="message-list">
      {hasMore && (
        <div className={styles.loadMore}>
          <button
            className={styles.loadMoreBtn}
            onClick={onLoadMore}
            type="button"
          >
            Load older messages
          </button>
        </div>
      )}

      <div className={styles.list}>
        {messages.map((msg) =>
          msg.type === "image_share" ? (
            <ImageShareCard
              key={msg.id}
              message={msg}
              onOpenThread={onOpenThread}
            />
          ) : (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenThread={onOpenThread}
              onDelete={onDeleteMessage}
            />
          )
        )}
      </div>

      <div ref={scrollRef} className={styles.scrollAnchor} />
    </div>
  );
}
