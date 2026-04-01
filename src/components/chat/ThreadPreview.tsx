"use client";

import styles from "./ThreadPreview.module.css";

interface ThreadPreviewProps {
  readonly messageId: string;
  readonly replyCount: number;
  readonly onOpenThread: (messageId: string) => void;
}

export function ThreadPreview({
  messageId,
  replyCount,
  onOpenThread,
}: ThreadPreviewProps) {
  const label =
    replyCount === 1 ? "1 reply" : `${replyCount} replies`;

  return (
    <button
      className={styles.link}
      onClick={() => onOpenThread(messageId)}
      type="button"
      data-testid="thread-preview"
    >
      {label} <span className={styles.arrow}>&rarr;</span>
    </button>
  );
}
