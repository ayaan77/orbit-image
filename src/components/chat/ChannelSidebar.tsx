"use client";

import { useEffect, useState, useRef } from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import type { Channel, Message } from "@/lib/chat/types";
import type Pusher from "pusher-js";
import styles from "./ChannelSidebar.module.css";

export function ChannelSidebar() {
  const { activeWorkspaceId, activeChannelId, setActiveChannel, pusherClient } =
    useChatContext();
  const [channels, setChannels] = useState<readonly Channel[]>([]);
  const [channelError, setChannelError] = useState<string | null>(null);
  // Local unread counts per channel — incremented via Pusher, cleared on activation
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const subscribedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeWorkspaceId) {
      setChannels([]);
      setChannelError(null);
      return;
    }

    let cancelled = false;
    setChannelError(null);

    async function fetchChannels() {
      try {
        const res = await apiFetch(
          `/api/chat/workspaces/${activeWorkspaceId}/channels`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list: Channel[] = Array.isArray(data)
            ? data
            : (data.channels ?? []);
          setChannels(list);
        } else if (!cancelled) {
          setChannelError("Failed to load channels");
        }
      } catch {
        if (!cancelled) setChannelError("Failed to load channels");
      }
    }

    fetchChannels();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  // Unsubscribe all channel subscriptions when workspace changes
  useEffect(() => {
    return () => {
      if (pusherClient) {
        const pusher = pusherClient as Pusher;
        subscribedRef.current.forEach((cid) => {
          pusher.unsubscribe(`private-channel-${cid}`);
        });
        subscribedRef.current.clear();
      }
    };
  }, [activeWorkspaceId, pusherClient]);

  // Subscribe to each channel's Pusher channel for real-time unread dots
  useEffect(() => {
    if (!pusherClient || channels.length === 0) return;

    const pusher = pusherClient as Pusher;
    const newSubscriptions: string[] = [];

    for (const ch of channels) {
      if (subscribedRef.current.has(ch.id)) continue;
      subscribedRef.current.add(ch.id);
      newSubscriptions.push(ch.id);

      const pusherChannel = pusher.subscribe(`private-channel-${ch.id}`);
      pusherChannel.bind("message.created", (msg: Message) => {
        // Only increment unread for channels the user isn't currently viewing
        setUnreadCounts((prev) => {
          if (msg.channelId === activeChannelId) return prev;
          return { ...prev, [msg.channelId]: (prev[msg.channelId] ?? 0) + 1 };
        });
      });
    }

    return () => {
      // Unsubscribe everything subscribed in this effect run
      subscribedRef.current.forEach((cid) => {
        pusher.unsubscribe(`private-channel-${cid}`);
      });
      subscribedRef.current.clear();
    };
    // activeChannelId intentionally excluded: the bind callback closes over it
    // via the setter form so stale closures are not a problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pusherClient, channels]);

  // Clear unread count when a channel becomes active
  useEffect(() => {
    if (!activeChannelId) return;
    setUnreadCounts((prev) => {
      if (!prev[activeChannelId]) return prev;
      const next = { ...prev };
      delete next[activeChannelId];
      return next;
    });
  }, [activeChannelId]);

  const regularChannels = channels.filter((ch) => !ch.isDm);
  const dmChannels = channels.filter((ch) => ch.isDm);

  if (!activeWorkspaceId) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.empty}>No workspace selected</div>
      </div>
    );
  }

  if (channelError) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.empty}>{channelError}</div>
      </div>
    );
  }

  return (
    <div className={styles.sidebar} data-testid="channel-sidebar">
      {/* Regular channels */}
      {regularChannels.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Channels</div>
          {regularChannels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              realtimeUnread={unreadCounts[ch.id] ?? 0}
              onClick={() => setActiveChannel(ch.id)}
            />
          ))}
        </>
      )}

      {/* DM channels */}
      {dmChannels.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Direct Messages</div>
          {dmChannels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.id === activeChannelId}
              realtimeUnread={unreadCounts[ch.id] ?? 0}
              onClick={() => setActiveChannel(ch.id)}
            />
          ))}
        </>
      )}

      {channels.length === 0 && (
        <div className={styles.empty}>No channels yet</div>
      )}
    </div>
  );
}

interface ChannelItemProps {
  readonly channel: Channel;
  readonly isActive: boolean;
  readonly realtimeUnread: number;
  readonly onClick: () => void;
}

function ChannelItem({ channel, isActive, realtimeUnread, onClick }: ChannelItemProps) {
  const itemClassName = isActive
    ? `${styles.channelItem} ${styles.channelItemActive}`
    : styles.channelItem;

  // Show unread dot if there are server-tracked unread mentions OR real-time new messages
  const hasUnread = (channel.unreadMentions ?? 0) > 0 || realtimeUnread > 0;

  return (
    <button className={itemClassName} onClick={onClick} type="button">
      {channel.isDm ? (
        <span className={styles.dmAvatar}>
          {channel.name.charAt(0).toUpperCase()}
        </span>
      ) : (
        <span className={styles.channelPrefix}>#</span>
      )}
      <span className={styles.channelName}>{channel.name}</span>
      {hasUnread && <span className={styles.unreadDot} aria-label="Unread" />}
    </button>
  );
}
