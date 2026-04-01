"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import { MessageList } from "./MessageList";
import { TypingIndicator } from "./TypingIndicator";
import { MessageComposer } from "./MessageComposer";
import { ThreadPane } from "./ThreadPane";
import type { Message } from "@/lib/chat/types";
import type Pusher from "pusher-js";
import styles from "./MessagePane.module.css";

interface TypingUser {
  readonly userId: string;
  readonly username: string;
}

export function MessagePane() {
  const { activeChannelId, activeChannelName, pusherClient, currentUserId } = useChatContext();
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [typingState, setTypingState] = useState<Record<string, TypingUser>>({});
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const oldestCursorRef = useRef<string | null>(null);

  // Reset and fetch messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    let cancelled = false;
    setMessages([]);
    setHasMore(false);
    setThreadParentId(null);
    oldestCursorRef.current = null;

    async function fetchMessages() {
      setIsLoading(true);
      try {
        const res = await apiFetch(
          `/api/chat/channels/${activeChannelId}/messages`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          const raw: Message[] = Array.isArray(data)
            ? data
            : (data.messages ?? []);
          // API returns newest-first (DESC); reverse to oldest-first for display
          const list = [...raw].reverse();
          setMessages(list);
          setHasMore(data.hasMore ?? false);
          if (list.length > 0) {
            // list[0] is now the oldest message — use as cursor for "load older"
            oldestCursorRef.current = list[0].id;
          }
        }
      } catch {
        // Network error — messages stay empty
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [activeChannelId]);

  // Subscribe to Pusher channel events
  useEffect(() => {
    if (!activeChannelId || !pusherClient) return;

    const pusher = pusherClient as Pusher;
    const channelName = `private-channel-${activeChannelId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("message.created", (newMsg: Message) => {
      // Deduplicate: optimistic update from onSent may have already added this message
      setMessages((prev) =>
        prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]
      );
    });

    channel.bind("message.deleted", (data: { id: string; deletedAt: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.id ? { ...msg, deletedAt: data.deletedAt } : msg
        )
      );
    });

    channel.bind(
      "reaction.toggled",
      (data: { messageId: string; reactions: Message["reactions"] }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId
              ? { ...msg, reactions: data.reactions }
              : msg
          )
        );
      }
    );

    channel.bind(
      "thread.reply",
      (data: { parentId: string; replyCount: number }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.parentId
              ? { ...msg, replyCount: data.replyCount }
              : msg
          )
        );
      }
    );

    channel.bind("typing.start", (data: { userId: string; username: string }) => {
      // Don't show typing indicator for the current user
      if (data.userId === currentUserId) return;

      setTypingState((prev) => ({ ...prev, [data.userId]: data }));

      // Auto-clear after 3s as a safety net if typing.stop is missed
      const timers = typingTimersRef.current;
      if (timers[data.userId]) clearTimeout(timers[data.userId]);
      timers[data.userId] = setTimeout(() => {
        setTypingState((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
        delete timers[data.userId];
      }, 3000);
    });

    channel.bind("typing.stop", (data: { userId: string; username?: string }) => {
      if (data.userId === currentUserId) return;

      const timers = typingTimersRef.current;
      if (timers[data.userId]) {
        clearTimeout(timers[data.userId]);
        delete timers[data.userId];
      }
      setTypingState((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      // Clear all typing timers on unmount
      const timers = typingTimersRef.current;
      Object.values(timers).forEach(clearTimeout);
      typingTimersRef.current = {};
    };
  }, [activeChannelId, pusherClient, currentUserId]);

  const handleLoadMore = useCallback(async () => {
    if (!activeChannelId || !oldestCursorRef.current) return;

    try {
      const res = await apiFetch(
        `/api/chat/channels/${activeChannelId}/messages?cursor=${oldestCursorRef.current}`
      );
      if (res.ok) {
        const data = await res.json();
        const rawOlder: Message[] = Array.isArray(data)
          ? data
          : (data.messages ?? []);
        // Reverse DESC result so older messages stay oldest-first
        const older = [...rawOlder].reverse();
        setMessages((prev) => [...older, ...prev]);
        setHasMore(data.hasMore ?? false);
        if (older.length > 0) {
          oldestCursorRef.current = older[0].id;
        }
      }
    } catch {
      // Network error — stop further load-more attempts
      setHasMore(false);
    }
  }, [activeChannelId]);

  const handleMessageSent = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      const res = await apiFetch(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, deletedAt: new Date().toISOString() }
              : msg
          )
        );
      }
    } catch {
      // Network error — ignore
    }
  }, []);

  if (!activeChannelId) return null;

  return (
    <div className={styles.pane} data-testid="message-pane" style={{ position: "relative" }}>
      {activeChannelName && (
        <div className={styles.channelHeader}>
          <span className={styles.channelHashIcon}>#</span>
          <span className={styles.channelHeaderName}>{activeChannelName}</span>
        </div>
      )}
      {isLoading ? (
        <div className={styles.loading}>Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className={styles.empty}>
          <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          <span>No messages yet</span>
          <span className={styles.emptyHint}>Be the first to start the conversation</span>
        </div>
      ) : (
        <MessageList
          messages={messages}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onOpenThread={setThreadParentId}
          onDeleteMessage={handleDeleteMessage}
          currentUserId={currentUserId ?? undefined}
        />
      )}

      <TypingIndicator typingUsers={Object.values(typingState).map((u) => u.username)} />
      <MessageComposer
        channelId={activeChannelId}
        onSent={handleMessageSent}
      />

      {threadParentId && (
        <ThreadPane
          parentId={threadParentId}
          onClose={() => setThreadParentId(null)}
        />
      )}
    </div>
  );
}
