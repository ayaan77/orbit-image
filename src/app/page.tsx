"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { GeneratorForm } from "@/components/GeneratorForm";
import { ImageGallery } from "@/components/ImageGallery";
import { ToastProvider, useToast } from "@/components/Toast";
import { SettingsModal } from "@/components/SettingsModal";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { Dashboard } from "@/components/Dashboard";
import { HistoryDrawer, type HistoryEntry } from "@/components/HistoryDrawer";
import { ConnectWizard } from "@/components/ConnectWizard";
import { useProviderStatus } from "@/lib/client/useProviderStatus";
import { estimateCost } from "@/lib/usage/cost";
import { getApiKey, hasApiKey, getIsAdmin, detectAdmin } from "@/lib/client/storage";
import type { GenerateRequest } from "@/types/api";
import styles from "./page.module.css";

const HISTORY_KEY = "orbit-history";
const MAX_HISTORY = 20;

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
  readonly cortexDataCached: boolean;
  readonly resultCached: boolean;
  readonly model?: string;
  readonly quality?: string;
  readonly count?: number;
}

type AppState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly result: GenerateResult }
  | { readonly status: "error"; readonly message: string };

function loadHistory(): readonly HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: readonly HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full — silently ignore
  }
}

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}

function HomeContent() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const [apiKeyPresent, setApiKeyPresent] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<readonly HistoryEntry[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const { showToast } = useToast();
  const { status: providerStatus, refresh: refreshProviders } = useProviderStatus();
  const lastRequestRef = useRef<GenerateRequest | null>(null);

  // Hydration-safe: read localStorage only on the client
  useEffect(() => {
    setApiKeyPresent(hasApiKey());
    setIsAdmin(getIsAdmin());
    setHistory(loadHistory());
  }, []);

  // Wizard removed — Dashboard's built-in SetupChecklist handles onboarding
  useEffect(() => {
    if (isAdmin && typeof window !== "undefined") {
      // Mark wizard as complete so it never blocks
      localStorage.setItem("orbit-wizard-complete", "true");
      setShowWizard(false);
    }
  }, [isAdmin]);

  // Detect admin status when API key is present
  useEffect(() => {
    if (apiKeyPresent) {
      detectAdmin().then(setIsAdmin);
    } else {
      setIsAdmin(false);
    }
  }, [apiKeyPresent]);

  // Persist history whenever it changes
  useEffect(() => {
    if (history.length > 0) saveHistory(history);
  }, [history]);

  const handleRestore = useCallback((entry: HistoryEntry) => {
    setState({
      status: "success",
      result: {
        images: entry.images,
        brand: entry.brand,
        processingTimeMs: entry.processingTimeMs,
        cortexDataCached: entry.cortexDataCached,
        resultCached: entry.resultCached,
        model: entry.model,
      },
    });
  }, []);

  const handleGenerate = useCallback(
    async (data: GenerateRequest) => {
      const key = getApiKey();
      if (!key) {
        showToast("Please configure your API key in Settings", "error");
        return;
      }

      lastRequestRef.current = data;
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

        const result: GenerateResult = {
          images: json.images,
          brand: json.brand,
          processingTimeMs: json.metadata.processingTimeMs,
          cortexDataCached: json.metadata.cortexDataCached ?? false,
          resultCached: json.metadata.resultCached ?? false,
          model: json.metadata.model ?? data.model,
          quality: data.quality,
          count: data.count,
        };

        setState({ status: "success", result });

        // Append to history (max 20 entries, immutable)
        const entry: HistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          images: result.images,
          brand: result.brand,
          purpose: data.purpose,
          topic: data.topic,
          processingTimeMs: result.processingTimeMs,
          cortexDataCached: result.cortexDataCached,
          resultCached: result.resultCached,
          generatedAt: Date.now(),
          model: data.model,
          style: data.style,
          estimatedCostUsd: estimateCost(data.count, data.quality, data.model),
        };
        setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
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

  const handleRerun = useCallback(
    (entry: HistoryEntry, overrides?: { model?: string }) => {
      const data: GenerateRequest = {
        topic: entry.topic,
        purpose: entry.purpose as GenerateRequest["purpose"],
        count: 1,
        quality: "hd",
        output_format: "base64",
        ...(entry.brand ? { brand: entry.brand } : {}),
        ...(entry.style ? { style: entry.style as GenerateRequest["style"] } : {}),
        ...(overrides?.model ? { model: overrides.model as GenerateRequest["model"] } : entry.model ? { model: entry.model as GenerateRequest["model"] } : {}),
      };
      handleGenerate(data);
    },
    [handleGenerate],
  );

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
    const keyPresent = hasApiKey();
    setApiKeyPresent(keyPresent);
    if (keyPresent) {
      detectAdmin().then(setIsAdmin);
      refreshProviders();
    } else {
      setIsAdmin(false);
    }
  }, [refreshProviders]);

  return (
    <>
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        onHistoryClick={() => setHistoryOpen(true)}
        historyCount={history.length}
        showStudioLink
        providerStatus={providerStatus}
      />

      {apiKeyPresent ? (
        isAdmin ? (
          <Dashboard />
        ) : (
          <main className={styles.main}>
            <div className={styles.container}>
              {/* Left: Form */}
              <section className={styles.formPanel}>
                <div className={styles.card}>
                  <GeneratorForm
                    onSubmit={handleGenerate}
                    isLoading={state.status === "loading"}
                    providerStatus={providerStatus}
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
                    cortexDataCached={state.result.cortexDataCached}
                    resultCached={state.result.resultCached}
                    model={state.result.model}
                    quality={state.result.quality}
                    count={state.result.count}
                  />
                )}
              </section>
            </div>
          </main>
        )
      ) : (
        <ApiKeyGate onKeySet={() => setApiKeyPresent(true)} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
      <HistoryDrawer
        isOpen={historyOpen}
        entries={history}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestore}
        onRerun={handleRerun}
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyVisual}>
        <div className={styles.orbitContainer}>
          <div className={styles.ring1} />
          <div className={styles.ring2} />
          <div className={styles.ring3} />
          <div className={styles.centerDot} />
        </div>
      </div>
      <h2 className={styles.emptyTitle}>
        Generate brand-consistent visuals in seconds
      </h2>
      <p className={styles.emptyText}>
        Describe what you need, pick a purpose, and Orbit applies your brand
        automatically.
      </p>

      {/* How it works steps */}
      <div className={styles.howItWorks}>
        <div className={styles.howStep}>
          <div className={styles.howStepIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className={styles.howStepTitle}>Describe</p>
          <p className={styles.howStepText}>Write what you want to visualize</p>
        </div>
        <div className={styles.howStepArrow}>&rarr;</div>
        <div className={styles.howStep}>
          <div className={styles.howStepIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <p className={styles.howStepTitle}>Pick a purpose</p>
          <p className={styles.howStepText}>Blog hero, ad creative, icon&hellip;</p>
        </div>
        <div className={styles.howStepArrow}>&rarr;</div>
        <div className={styles.howStep}>
          <div className={styles.howStepIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className={styles.howStepTitle}>Get results</p>
          <p className={styles.howStepText}>Brand-consistent images, instantly</p>
        </div>
      </div>

      {/* Example prompt */}
      <div className={styles.examplePrompt}>
        <span className={styles.exampleLabel}>Example</span>
        <span className={styles.exampleText}>
          &ldquo;A modern SaaS dashboard with glowing analytics charts and dark
          UI&rdquo;
        </span>
      </div>
    </div>
  );
}

const LOADING_STEPS = [
  { label: "Fetching brand data", subtext: "Fetching brand voice and color palette..." },
  { label: "Assembling prompt", subtext: "Assembling your visual prompt..." },
  { label: "Rendering image", subtext: "Rendering with AI — almost there..." },
] as const;

function LoadingState() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setActiveStep(1), 2500);
    const t2 = setTimeout(() => setActiveStep(2), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

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
        {LOADING_STEPS[activeStep].subtext}
      </p>
      <div className={styles.loadingSteps}>
        {LOADING_STEPS.map((step, i) => (
          <span
            key={step.label}
            className={`${styles.step} ${
              i < activeStep
                ? styles.stepComplete
                : i === activeStep
                  ? styles.stepActive
                  : ""
            }`}
          >
            {i < activeStep ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={styles.stepCheck}>
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <span className={`${styles.stepDot} ${i === activeStep ? styles.stepDotActive : ""}`} />
            )}
            {step.label}
          </span>
        ))}
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
