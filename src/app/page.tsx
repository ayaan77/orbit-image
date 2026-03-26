"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { GeneratorForm } from "@/components/GeneratorForm";
import { ImageGallery } from "@/components/ImageGallery";
import { ToastProvider, useToast } from "@/components/Toast";
import { SettingsModal } from "@/components/SettingsModal";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { getApiKey, hasApiKey } from "@/lib/client/storage";
import type { GenerateRequest } from "@/types/api";
import styles from "./page.module.css";

interface GeneratedImage {
  readonly base64: string;
  readonly prompt: string;
  readonly mimeType: string;
  readonly dimensions: { readonly width: number; readonly height: number };
}

interface GenerateResult {
  readonly images: readonly GeneratedImage[];
  readonly brand: string;
  readonly processingTimeMs: number;
}

type AppState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly result: GenerateResult }
  | { readonly status: "error"; readonly message: string };

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}

function HomeContent() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const [apiKeyPresent, setApiKeyPresent] = useState(() => hasApiKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { showToast } = useToast();

  const handleGenerate = useCallback(
    async (data: GenerateRequest) => {
      const key = getApiKey();
      if (!key) {
        showToast("Please configure your API key in Settings", "error");
        return;
      }

      setState({ status: "loading" });

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(data),
        });

        const json = await response.json();

        if (!response.ok || !json.success) {
          const errorMsg =
            json.error?.message ?? `Request failed (${response.status})`;
          setState({ status: "error", message: errorMsg });
          return;
        }

        setState({
          status: "success",
          result: {
            images: json.images,
            brand: json.brand,
            processingTimeMs: json.metadata.processingTimeMs,
          },
        });
      } catch (err) {
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
        });
      }
    },
    [showToast],
  );

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
    setApiKeyPresent(hasApiKey());
  }, []);

  return (
    <>
      <Header onSettingsClick={() => setSettingsOpen(true)} />

      {apiKeyPresent ? (
        <main className={styles.main}>
          <div className={styles.container}>
            {/* Left: Form */}
            <section className={styles.formPanel}>
              <div className={styles.card}>
                <GeneratorForm
                  onSubmit={handleGenerate}
                  isLoading={state.status === "loading"}
                />
              </div>
            </section>

            {/* Right: Results */}
            <section className={styles.resultPanel}>
              {state.status === "idle" && <EmptyState />}
              {state.status === "loading" && <LoadingState />}
              {state.status === "error" && (
                <ErrorState
                  message={state.message}
                  onDismiss={() => setState({ status: "idle" })}
                />
              )}
              {state.status === "success" && (
                <ImageGallery
                  images={state.result.images}
                  brand={state.result.brand}
                  processingTimeMs={state.result.processingTimeMs}
                />
              )}
            </section>
          </div>
        </main>
      ) : (
        <ApiKeyGate onKeySet={() => setApiKeyPresent(true)} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    </>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyVisual}>
        {/* Animated orbit rings */}
        <div className={styles.orbitContainer}>
          <div className={styles.ring1} />
          <div className={styles.ring2} />
          <div className={styles.ring3} />
          <div className={styles.centerDot} />
        </div>
      </div>
      <h2 className={styles.emptyTitle}>Ready to generate</h2>
      <p className={styles.emptyText}>
        Describe your image and let AI craft brand-consistent visuals.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingState}>
      <div className={styles.loadingVisual}>
        <div className={styles.loadingRing}>
          <div className={styles.loadingDot} />
        </div>
        <div className={styles.loadingPulse} />
      </div>
      <p className={styles.loadingText}>Generating...</p>
      <p className={styles.loadingSubtext}>
        Pulling brand context and crafting your prompt
      </p>
      <div className={styles.loadingSteps}>
        <span className={styles.step}>
          <span className={styles.stepDot} style={{ animationDelay: "0s" }} />
          Fetching brand data
        </span>
        <span className={styles.step}>
          <span className={styles.stepDot} style={{ animationDelay: "0.3s" }} />
          Assembling prompt
        </span>
        <span className={styles.step}>
          <span className={styles.stepDot} style={{ animationDelay: "0.6s" }} />
          Rendering image
        </span>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onDismiss,
}: {
  readonly message: string;
  readonly onDismiss: () => void;
}) {
  return (
    <div className={styles.errorState}>
      <div className={styles.errorIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M12 8V12M12 16H12.01"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className={styles.errorTitle}>Something went wrong</p>
      <p className={styles.errorMessage}>{message}</p>
      <button className={styles.errorDismiss} onClick={onDismiss}>
        Try Again
      </button>
    </div>
  );
}
