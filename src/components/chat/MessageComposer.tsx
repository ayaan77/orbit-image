"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useChatContext } from "./ChatProvider";
import { apiFetch } from "@/lib/client/api";
import type { Message, MemberSummary } from "@/lib/chat/types";
import styles from "./MessageComposer.module.css";

interface MessageComposerProps {
  readonly channelId: string;
  readonly parentId?: string;
  readonly onSent: (msg: Message) => void;
}

export function MessageComposer({
  channelId,
  parentId,
  onSent,
}: MessageComposerProps) {
  const { activeWorkspaceId } = useChatContext();
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<readonly MemberSummary[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "36px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [content]);

  // Fetch mention results
  useEffect(() => {
    if (mentionQuery === null || !activeWorkspaceId) {
      setMentionResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/chat/workspaces/${activeWorkspaceId}/members?q=${encodeURIComponent(mentionQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          const members: MemberSummary[] = Array.isArray(data)
            ? data
            : (data.members ?? []);
          setMentionResults(members.slice(0, 10));
          setMentionIndex(0);
        }
      } catch {
        setMentionResults([]);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mentionQuery, activeWorkspaceId]);

  const detectMentionQuery = useCallback(
    (value: string, cursorPos: number) => {
      // Look backwards from cursor for @word
      const beforeCursor = value.slice(0, cursorPos);
      const match = beforeCursor.match(/@(\w*)$/);
      if (match) {
        setMentionQuery(match[1]);
      } else {
        setMentionQuery(null);
        setMentionResults([]);
      }
    },
    []
  );

  const insertMention = useCallback(
    (username: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const cursorPos = el.selectionStart;
      const beforeCursor = content.slice(0, cursorPos);
      const afterCursor = content.slice(cursorPos);

      // Replace @partialWord with @username
      const updatedBefore = beforeCursor.replace(/@\w*$/, `@${username} `);
      const newContent = updatedBefore + afterCursor;

      setContent(newContent);
      setMentionQuery(null);
      setMentionResults([]);

      // Set cursor position after the inserted mention
      requestAnimationFrame(() => {
        el.focus();
        const newPos = updatedBefore.length;
        el.setSelectionRange(newPos, newPos);
      });
    },
    [content]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      detectMentionQuery(value, e.target.selectionStart);
    },
    [detectMentionQuery]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const endpoint = parentId
        ? `/api/chat/messages/${parentId}/thread`
        : `/api/chat/channels/${channelId}/messages`;

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          type: "text",
          ...(parentId ? {} : {}),
        }),
      });

      if (res.ok) {
        const msg: Message = await res.json();
        setContent("");
        setMentionQuery(null);
        setMentionResults([]);
        onSent(msg);
      }
    } catch {
      // Network error — message stays in textarea
    } finally {
      setIsSending(false);
    }
  }, [content, isSending, channelId, parentId, onSent]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Mention navigation
      if (mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((prev) =>
            prev < mentionResults.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((prev) =>
            prev > 0 ? prev - 1 : mentionResults.length - 1
          );
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          insertMention(mentionResults[mentionIndex].username);
          return;
        }
        if (e.key === "Escape") {
          setMentionQuery(null);
          setMentionResults([]);
          return;
        }
      }

      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [mentionResults, mentionIndex, insertMention, handleSubmit]
  );

  return (
    <div className={styles.composer} data-testid="message-composer">
      {/* Mention autocomplete dropdown */}
      {mentionResults.length > 0 && (
        <div className={styles.mentionDropdown} data-testid="mention-dropdown">
          {mentionResults.map((member, idx) => (
            <button
              key={member.id}
              className={`${styles.mentionItem} ${idx === mentionIndex ? styles.mentionItemActive : ""}`}
              onClick={() => insertMention(member.username)}
              type="button"
            >
              <span className={styles.mentionAvatar}>
                {member.username.charAt(0).toUpperCase()}
              </span>
              <span className={styles.mentionUsername}>{member.username}</span>
              <span className={styles.mentionRole}>{member.role}</span>
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={parentId ? "Reply in thread..." : "Type a message..."}
        rows={1}
        disabled={isSending}
        data-testid="message-input"
      />

      <button
        className={styles.sendBtn}
        onClick={handleSubmit}
        disabled={!content.trim() || isSending}
        aria-label="Send message"
        type="button"
        data-testid="send-btn"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
