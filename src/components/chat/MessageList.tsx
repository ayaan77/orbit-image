"use client";

import { useEffect, useRef, useCallback } from "react";
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
  readonly currentUserId?: string;
}

export function MessageList({
  messages,
  hasMore,
  onLoadMore,
  onOpenThread,
  onDeleteMessage,
  currentUserId,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const isLoadingMoreRef = useRef(false);

  // Auto-scroll to bottom on new messages (not when loading older messages)
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Reset loading guard when hasMore or messages change (load completed)
  useEffect(() => {
    isLoadingMoreRef.current = false;
  }, [messages.length, hasMore]);

  // Scroll-to-top triggers pagination
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || !hasMore || isLoadingMoreRef.current) return;
    if (el.scrollTop < 10) {
      isLoadingMoreRef.current = true;
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div ref={containerRef} className={styles.container} data-testid="message-list">
      {/* Fallback load-more button for keyboard / accessibility */}
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
              currentUserId={currentUserId}
            />
          ) : (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenThread={onOpenThread}
              onDelete={onDeleteMessage}
              currentUserId={currentUserId}
            />
          )
        )}
      </div>

      <div ref={scrollRef} className={styles.scrollAnchor} />
    </div>
  );
}
