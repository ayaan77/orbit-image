"use client";

import { useState, useRef } from "react";
import { setApiKey } from "@/lib/client/storage";
import { useToast } from "@/components/Toast";
import styles from "./ApiKeyGate.module.css";

interface ApiKeyGateProps {
  readonly onKeySet: () => void;
}

export function ApiKeyGate({ onKeySet }: ApiKeyGateProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    showToast("API key saved — you're all set!", "success");
    onKeySet();
  };

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        {/* Orbit visual */}
        <div className={styles.visual}>
          <div className={styles.orbitContainer}>
            <div className={styles.ring1} />
            <div className={styles.ring2} />
            <div className={styles.centerDot} />
          </div>
        </div>

        <h1 className={styles.heading}>
          Welcome to <span className={styles.accent}>Orbit Image</span>
        </h1>
        <p className={styles.description}>
          Enter your API key to start generating brand-aware images. You can get
          your key from your administrator or deployment config.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="gate-api-key">
            API Key
          </label>
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              id="gate-api-key"
              type={showKey ? "text" : "password"}
              className={styles.input}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your API key here..."
              spellCheck={false}
              autoComplete="off"
              autoFocus
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
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!key.trim()}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M3 9L8 14L15 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Get Started
          </button>
        </form>
      </div>
    </div>
  );
}
