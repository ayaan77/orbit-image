"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/client/api";
import type { Reaction } from "@/lib/chat/types";
import styles from "./ReactionBar.module.css";

const PRESET_EMOJIS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F525}", "\u{1F602}", "\u{1F389}", "\u{1F440}"] as const;

interface ReactionBarProps {
  readonly messageId: string;
  readonly reactions: readonly Reaction[];
}

export function ReactionBar({ messageId, reactions }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  const toggleReaction = useCallback(
    async (emoji: string) => {
      setShowPicker(false);
      try {
        await apiFetch(`/api/chat/messages/${messageId}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji }),
        });
      } catch {
        // Network error — ignore, real-time will reconcile
      }
    },
    [messageId]
  );

  return (
    <div className={styles.bar} data-testid="reaction-bar">
      {reactions.map((reaction) => {
        const pillClass = reaction.userReacted
          ? `${styles.pill} ${styles.pillActive}`
          : styles.pill;

        return (
          <button
            key={reaction.emoji}
            className={pillClass}
            onClick={() => toggleReaction(reaction.emoji)}
            type="button"
            data-testid="reaction-pill"
          >
            <span>{reaction.emoji}</span>
            <span className={styles.count}>{reaction.count}</span>
          </button>
        );
      })}

      <div style={{ position: "relative" }} ref={pickerRef}>
        <button
          className={styles.addBtn}
          onClick={() => setShowPicker((prev) => !prev)}
          aria-label="Add reaction"
          type="button"
          data-testid="add-reaction-btn"
        >
          +
        </button>

        {showPicker && (
          <div className={styles.picker} data-testid="emoji-picker">
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className={styles.pickerEmoji}
                onClick={() => toggleReaction(emoji)}
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
