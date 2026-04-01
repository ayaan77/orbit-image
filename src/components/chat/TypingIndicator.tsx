"use client";

import styles from "./TypingIndicator.module.css";

interface TypingIndicatorProps {
  /** Usernames of people currently typing. If empty, renders null. */
  readonly typingUsers: readonly string[];
}

function buildTypingText(users: readonly string[]): string {
  if (users.length === 1) return `${users[0]} is typing…`;
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing…`;
  return "Several people are typing…";
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  return (
    <div className={styles.container} data-testid="typing-indicator">
      <span className={styles.text}>{buildTypingText(typingUsers)}</span>
    </div>
  );
}

// Note: This component uses a preset typing-user list provided by MessagePane,
// which handles the Pusher typing.start / typing.stop events.
// A full emoji-mart picker can be added in future if richer reactions are needed.
