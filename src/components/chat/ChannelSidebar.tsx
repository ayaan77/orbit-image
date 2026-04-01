"use client";

import { useEffect, useState } from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import type { Channel } from "@/lib/chat/types";
import styles from "./ChannelSidebar.module.css";

export function ChannelSidebar() {
  const { activeWorkspaceId, activeChannelId, setActiveChannel } =
    useChatContext();
  const [channels, setChannels] = useState<readonly Channel[]>([]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setChannels([]);
      return;
    }

    let cancelled = false;

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
        }
      } catch {
        // Network error — channels stay empty
      }
    }

    fetchChannels();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const regularChannels = channels.filter((ch) => !ch.isDm);
  const dmChannels = channels.filter((ch) => ch.isDm);

  if (!activeWorkspaceId) {
    return (
      <div className={styles.sidebar}>
        <div className={styles.empty}>No workspace selected</div>
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
  readonly onClick: () => void;
}

function ChannelItem({ channel, isActive, onClick }: ChannelItemProps) {
  const itemClassName = isActive
    ? `${styles.channelItem} ${styles.channelItemActive}`
    : styles.channelItem;

  const hasUnread = (channel.unreadMentions ?? 0) > 0;

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
