"use client";

import { useEffect, useState, useCallback } from "react";
import { useChatContext } from "./ChatProvider";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ChannelSidebar } from "./ChannelSidebar";
import { MessagePane } from "./MessagePane";
import styles from "./ChatPanel.module.css";

export function ChatPanel() {
  const { isPanelOpen, activeChannelId, closePanel } = useChatContext();

  // Close on Escape key
  useEffect(() => {
    if (!isPanelOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPanelOpen, closePanel]);

  const panelClassName = isPanelOpen
    ? `${styles.panel} ${styles.open}`
    : styles.panel;

  return (
    <div
      className={panelClassName}
      role="dialog"
      aria-modal="true"
      aria-label="Chat panel"
      data-testid="chat-panel"
    >
      {/* Header bar */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Chat</span>
        <button
          className={styles.closeBtn}
          onClick={closePanel}
          aria-label="Close chat panel"
          type="button"
          data-testid="chat-close-btn"
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

      {/* Workspace pills */}
      <WorkspaceSwitcher />

      {/* Sidebar + Messages */}
      <div className={styles.content}>
        <ChannelSidebar />
        {activeChannelId ? (
          <MessagePane />
        ) : (
          <EmptyChannelState />
        )}
      </div>
    </div>
  );
}

function EmptyChannelState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#818cf8",
        fontSize: "0.8125rem",
        padding: "24px",
        textAlign: "center",
      }}
    >
      Select a channel to start chatting
    </div>
  );
}
