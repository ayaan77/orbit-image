"use client";

import { useEffect, useState, useCallback } from "react";
import { useChatContext } from "./ChatProvider";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { ChannelSidebar } from "./ChannelSidebar";
import { MessagePane } from "./MessagePane";
import styles from "./ChatPanel.module.css";

/** Returns true when the viewport is ≤ 639px (mobile). */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

export function ChatPanel() {
  const { isPanelOpen, activeChannelId, closePanel, pusherClient } = useChatContext();
  const isMobile = useIsMobile();
  // Show Pusher unavailable banner only after initial load (avoid flash)
  const [pusherChecked, setPusherChecked] = useState(false);

  useEffect(() => {
    if (!isPanelOpen) return;
    const timer = setTimeout(() => setPusherChecked(true), 2000);
    return () => clearTimeout(timer);
  }, [isPanelOpen]);

  // On mobile the sidebar starts collapsed; on desktop it's always visible.
  const [sidebarVisible, setSidebarVisible] = useState(!isMobile);

  // When viewport changes between mobile/desktop, reset visibility accordingly.
  useEffect(() => {
    setSidebarVisible(!isMobile);
  }, [isMobile]);

  // When a channel is selected on mobile, hide the sidebar so the message pane fills the width.
  useEffect(() => {
    if (isMobile && activeChannelId) {
      setSidebarVisible(false);
    }
  }, [isMobile, activeChannelId]);

  // Close on Escape key
  useEffect(() => {
    if (!isPanelOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isPanelOpen, closePanel]);

  const handleShowSidebar = useCallback(() => setSidebarVisible(true), []);
  const handleHideSidebar = useCallback(() => setSidebarVisible(false), []);

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
        {/* On mobile: back button when sidebar is hidden and a channel is active */}
        {isMobile && !sidebarVisible && activeChannelId ? (
          <button
            className={styles.backBtn}
            onClick={handleShowSidebar}
            aria-label="Back to channels"
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path
                d="M11 4L6 9l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Channels
          </button>
        ) : (
          <span className={styles.headerTitle}>Chat</span>
        )}

        <div className={styles.headerActions}>
          {/* Mobile: toggle sidebar when viewing message pane */}
          {isMobile && sidebarVisible && (
            <button
              className={styles.closeBtn}
              onClick={handleHideSidebar}
              aria-label="Hide channels"
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path
                  d="M11 4L6 9l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
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
      </div>

      {/* Workspace pills */}
      <WorkspaceSwitcher />

      {/* Pusher unavailable banner — only shown when Pusher is configured but connection failed */}
      {pusherChecked && !!process.env.NEXT_PUBLIC_PUSHER_KEY && !pusherClient && (
        <div className={styles.pusherBanner} role="alert">
          Real-time updates unavailable — refresh to retry.
        </div>
      )}

      {/* Sidebar + Messages */}
      <div className={styles.content}>
        {/* On mobile: show either sidebar OR message pane, not both */}
        {(!isMobile || sidebarVisible) && (
          <div className={isMobile ? styles.mobileSidebar : undefined}>
            <ChannelSidebar />
          </div>
        )}
        {(!isMobile || !sidebarVisible) && (
          activeChannelId ? (
            <MessagePane />
          ) : (
            <EmptyChannelState />
          )
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
