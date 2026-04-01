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

export function MessagePane() {
  const { activeChannelId, pusherClient } = useChatContext();
  const [messages, setMessages] = useState<readonly Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
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
          const list: Message[] = Array.isArray(data)
            ? data
            : (data.messages ?? []);
          setMessages(list);
          setHasMore(data.hasMore ?? false);
          if (list.length > 0) {
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
      setMessages((prev) => [...prev, newMsg]);
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

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeChannelId, pusherClient]);

  const handleLoadMore = useCallback(async () => {
    if (!activeChannelId || !oldestCursorRef.current) return;

    try {
      const res = await apiFetch(
        `/api/chat/channels/${activeChannelId}/messages?cursor=${oldestCursorRef.current}`
      );
      if (res.ok) {
        const data = await res.json();
        const older: Message[] = Array.isArray(data)
          ? data
          : (data.messages ?? []);
        setMessages((prev) => [...older, ...prev]);
        setHasMore(data.hasMore ?? false);
        if (older.length > 0) {
          oldestCursorRef.current = older[0].id;
        }
      }
    } catch {
      // Network error — ignore
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
      {isLoading ? (
        <div className={styles.loading}>Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className={styles.empty}>
          <span>No messages yet</span>
          <span className={styles.emptyHint}>
            Start the conversation below
          </span>
        </div>
      ) : (
        <MessageList
          messages={messages}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onOpenThread={setThreadParentId}
          onDeleteMessage={handleDeleteMessage}
        />
      )}

      <TypingIndicator channelId={activeChannelId} />
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
