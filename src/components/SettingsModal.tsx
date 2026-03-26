"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { getApiKey, setApiKey, clearApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import styles from "./SettingsModal.module.css";

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type ConnectionStatus =
  | { readonly state: "idle" }
  | { readonly state: "testing" }
  | {
      readonly state: "done";
      readonly status: "healthy" | "degraded" | "unhealthy";
      readonly cortex: boolean;
      readonly openai: boolean;
    };

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus>({
    state: "idle",
  });
  const { showToast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  // Populate the input when the modal opens
  useEffect(() => {
    if (isOpen) {
      setKeyValue(getApiKey());
      setShowKey(false);
      setConnection({ state: "idle" });
      // Focus the input on next frame
      requestAnimationFrame(() => firstFocusRef.current?.focus());
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const handleSave = useCallback(() => {
    const trimmed = keyValue.trim();
    if (!trimmed) {
      showToast("API key cannot be empty", "error");
      return;
    }
    setApiKey(trimmed);
    showToast("API key saved", "success");
  }, [keyValue, showToast]);

  const handleTestConnection = useCallback(async () => {
    const key = getApiKey();
    if (!key) {
      showToast("Save an API key first", "error");
      return;
    }
    setConnection({ state: "testing" });
    try {
      const res = await fetch("/api/health", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      setConnection({
        state: "done",
        status: data.status ?? "unhealthy",
        cortex: data.cortex?.reachable ?? false,
        openai: data.openai?.configured ?? false,
      });
    } catch {
      setConnection({
        state: "done",
        status: "unhealthy",
        cortex: false,
        openai: false,
      });
    }
  }, []);

  const handleClear = useCallback(() => {
    clearApiKey();
    setKeyValue("");
    showToast("Settings cleared", "info");
    onClose();
  }, [onClose, showToast]);

  if (!isOpen) return null;

  const statusDotClass =
    connection.state === "done"
      ? connection.status === "healthy"
        ? styles.dotGreen
        : connection.status === "degraded"
          ? styles.dotYellow
          : styles.dotRed
      : "";

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* API Key Section */}
        <div className={styles.section}>
          <label className={styles.label} htmlFor="settings-api-key">
            API Key
          </label>
          <div className={styles.inputRow}>
            <input
              ref={firstFocusRef}
              id="settings-api-key"
              type={showKey ? "text" : "password"}
              className={styles.input}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Enter your API key..."
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              className={styles.toggleVisibility}
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
            </button>
          </div>
          <button className={styles.saveBtn} onClick={handleSave}>
            Save Key
          </button>
        </div>

        {/* Connection Status */}
        <div className={styles.section}>
          <label className={styles.label}>Connection Status</label>
          <div className={styles.statusRow}>
            <button
              className={styles.testBtn}
              onClick={handleTestConnection}
              disabled={connection.state === "testing"}
            >
              {connection.state === "testing" ? (
                <>
                  <span className={styles.spinner} />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </button>
            {connection.state === "done" && (
              <div className={styles.statusResult}>
                <span className={`${styles.statusDot} ${statusDotClass}`} />
                <span className={styles.statusText}>
                  {connection.status === "healthy"
                    ? "Connected"
                    : connection.status === "degraded"
                      ? "Degraded"
                      : "Unreachable"}
                </span>
              </div>
            )}
          </div>
          {connection.state === "done" && (
            <div className={styles.statusDetails}>
              <span>
                Cortex: {connection.cortex ? "Reachable" : "Unreachable"}
              </span>
              <span>
                OpenAI: {connection.openai ? "Configured" : "Not configured"}
              </span>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className={styles.dangerSection}>
          <button className={styles.clearBtn} onClick={handleClear}>
            Clear All Settings
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
