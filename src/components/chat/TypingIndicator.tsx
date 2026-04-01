"use client";

// TODO Phase 6: Implement typing indicators via Pusher client events
// Listen to typing.start and typing.stop on private-channel-{channelId}
// Display "Ahmed is typing..." or "Ahmed and Sara are typing..."
// Auto-remove typing users after 3s if no new event

import styles from "./TypingIndicator.module.css";

interface TypingIndicatorProps {
  readonly channelId: string;
}

export function TypingIndicator({ channelId: _channelId }: TypingIndicatorProps) {
  // Phase 6: Will use useChatContext() to get pusherClient
  // and subscribe to typing events on the active channel

  // For now, render nothing — typing indicators will be added in Phase 6 polish
  return <div className={styles.container} data-testid="typing-indicator" />;
}
