"use client";

import { useState, useCallback, useEffect } from "react";
import { getApiKey } from "@/lib/client/storage";
import { MODEL_CATALOG, DEFAULT_MODEL, type ModelId } from "@/lib/providers/models";
import styles from "./ConnectWizard.module.css";

type ProviderKey = "openai" | "replicate" | "xai";

interface ProviderCard {
  readonly key: ProviderKey;
  readonly name: string;
  readonly description: string;
  readonly docsUrl: string;
  readonly envVar: string;
  readonly models: string[];
}

const PROVIDERS: readonly ProviderCard[] = [
  {
    key: "openai",
    name: "OpenAI",
    description: "GPT Image 1 and DALL-E 3 — reliable, high-quality image generation.",
    docsUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
    models: ["GPT Image 1", "DALL-E 3"],
  },
  {
    key: "replicate",
    name: "Replicate",
    description: "Flux models — fast generation with great style control.",
    docsUrl: "https://replicate.com/account/api-tokens",
    envVar: "REPLICATE_API_TOKEN",
    models: ["Flux 1.1 Pro", "Flux Dev", "Flux Schnell"],
  },
  {
    key: "xai",
    name: "xAI",
    description: "Grok Aurora — creative, unique image generation.",
    docsUrl: "https://console.x.ai",
    envVar: "XAI_API_KEY",
    models: ["Grok Aurora"],
  },
];

type Step = 0 | 1 | 2 | 3;

interface ProviderStatus {
  readonly configured: boolean;
  readonly testing: boolean;
  readonly healthy?: boolean;
}

interface ConnectWizardProps {
  readonly onComplete: () => void;
  readonly onClose: () => void;
}

export function ConnectWizard({ onComplete, onClose }: ConnectWizardProps) {
  const [step, setStep] = useState<Step>(0);
  const [providerStatus, setProviderStatus] = useState<Record<ProviderKey, ProviderStatus>>({
    openai: { configured: false, testing: false },
    replicate: { configured: false, testing: false },
    xai: { configured: false, testing: false },
  });
  const [brands, setBrands] = useState<readonly string[]>([]);
  const [cortexHealthy, setCortexHealthy] = useState<boolean | null>(null);
  const [defaultModel, setDefaultModel] = useState<ModelId>(DEFAULT_MODEL);

  // Fetch provider status on mount
  useEffect(() => {
    const key = getApiKey();
    if (!key) return;

    fetch("/api/providers/status", {
      headers: { Authorization: `Bearer ${key}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) {
          setProviderStatus((prev) => ({
            openai: { ...prev.openai, configured: data.providers.openai.configured },
            replicate: { ...prev.replicate, configured: data.providers.replicate.configured },
            xai: { ...prev.xai, configured: data.providers.xai.configured },
          }));
        }
      })
      .catch(() => {});

    // Fetch brands
    fetch("/api/brands", {
      headers: { Authorization: `Bearer ${key}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.brands) {
          setBrands(data.brands.map((b: { id: string }) => b.id));
        }
      })
      .catch(() => {});
  }, []);

  const testProvider = useCallback(async (provider: ProviderKey) => {
    setProviderStatus((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], testing: true },
    }));

    try {
      const key = getApiKey();
      const res = await fetch("/api/health", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const data = await res.json();
      const healthy = data.status === "healthy" || data.status === "degraded";
      setProviderStatus((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], testing: false, healthy },
      }));
      if (data.cortex) {
        setCortexHealthy(data.cortex.reachable ?? false);
      }
    } catch {
      setProviderStatus((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], testing: false, healthy: false },
      }));
    }
  }, []);

  const configuredCount = Object.values(providerStatus).filter((p) => p.configured).length;
  const canProceed = providerStatus.openai.configured; // At minimum OpenAI

  const handleFinish = () => {
    localStorage.setItem("orbit-wizard-complete", "true");
    onComplete();
  };

  return (
    <div className={styles.wizard}>
      <div className={styles.header}>
        <h2 className={styles.title}>Setup Wizard</h2>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close wizard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Step indicator */}
      <div className={styles.steps}>
        {(["Providers", "Brand", "Defaults", "Done"] as const).map((label, i) => (
          <button
            key={label}
            className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ""} ${i < step ? styles.stepDotDone : ""}`}
            onClick={() => i <= step && setStep(i as Step)}
            aria-label={`Step ${i + 1}: ${label}`}
          >
            <span className={styles.stepNumber}>{i < step ? "\u2713" : i + 1}</span>
            <span className={styles.stepLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className={styles.body}>
        {/* Step 0: Providers */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <p className={styles.stepDesc}>
              Connect at least one image provider. OpenAI is required; the others unlock additional models.
            </p>
            <div className={styles.providerGrid}>
              {PROVIDERS.map((p) => {
                const status = providerStatus[p.key];
                return (
                  <div
                    key={p.key}
                    className={`${styles.providerCard} ${status.configured ? styles.providerCardActive : ""}`}
                  >
                    <div className={styles.providerHeader}>
                      <span
                        className={styles.providerDot}
                        style={{ backgroundColor: `var(--provider-${p.key})` }}
                      />
                      <span className={styles.providerName}>{p.name}</span>
                      {p.key === "openai" && <span className={styles.requiredTag}>Required</span>}
                      <span className={`${styles.statusBadge} ${status.configured ? styles.statusConfigured : styles.statusMissing}`}>
                        {status.configured ? "Connected" : "Not configured"}
                      </span>
                    </div>
                    <p className={styles.providerDesc}>{p.description}</p>
                    <div className={styles.providerModels}>
                      {p.models.map((m) => (
                        <span key={m} className={styles.modelTag}>{m}</span>
                      ))}
                    </div>
                    <div className={styles.providerActions}>
                      <span className={styles.envHint}>Set <code>{p.envVar}</code> in your environment</span>
                      <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className={styles.docsLink}>
                        Get API Key &rarr;
                      </a>
                      {status.configured && (
                        <button
                          className={styles.testBtn}
                          onClick={() => testProvider(p.key)}
                          disabled={status.testing}
                        >
                          {status.testing ? "Testing..." : status.healthy === true ? "\u2713 Healthy" : status.healthy === false ? "Retry Test" : "Test Connection"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Brand */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <p className={styles.stepDesc}>
              Cortex provides brand context (colors, voice, personas) for truly brand-aware generation.
            </p>
            <div className={styles.cortexStatus}>
              <span className={`${styles.statusBadge} ${cortexHealthy ? styles.statusConfigured : styles.statusMissing}`}>
                Cortex MCP: {cortexHealthy === null ? "Unknown" : cortexHealthy ? "Connected" : "Not reachable"}
              </span>
            </div>
            {brands.length > 0 ? (
              <div className={styles.brandList}>
                <p className={styles.brandListLabel}>Available brands:</p>
                <div className={styles.brandChips}>
                  {brands.map((b) => (
                    <span key={b} className={styles.brandChip}>{b}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.noBrandsHint}>
                No brands detected. Set <code>CORTEX_BASE_URL</code> to connect your Cortex instance.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Defaults */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <p className={styles.stepDesc}>
              Choose a default model for new generations. Users can always override this per-request.
            </p>
            <div className={styles.defaultModelGrid}>
              {(Object.keys(MODEL_CATALOG) as ModelId[]).map((id) => {
                const entry = MODEL_CATALOG[id];
                const isConfigured = providerStatus[entry.provider as ProviderKey]?.configured;
                const isSelected = id === defaultModel;
                return (
                  <button
                    key={id}
                    className={`${styles.defaultModelCard} ${isSelected ? styles.defaultModelSelected : ""}`}
                    onClick={() => isConfigured && setDefaultModel(id)}
                    disabled={!isConfigured}
                  >
                    <span className={styles.providerDot} style={{ backgroundColor: `var(--provider-${entry.provider})` }} />
                    <span>{entry.displayName}</span>
                    {!isConfigured && <span className={styles.lockIcon}>🔒</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className={`${styles.stepContent} ${styles.doneStep}`}>
            <div className={styles.doneIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--success)" strokeWidth="2" />
                <path d="M8 12l2.5 2.5L16 9" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className={styles.doneTitle}>You&apos;re all set!</h3>
            <p className={styles.doneDesc}>
              {configuredCount} provider{configuredCount !== 1 ? "s" : ""} connected.
              {brands.length > 0 && ` ${brands.length} brand${brands.length !== 1 ? "s" : ""} available.`}
            </p>
            <button className={styles.doneBtn} onClick={handleFinish}>
              Start Generating
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {step < 3 && (
        <div className={styles.nav}>
          {step > 0 && (
            <button className={styles.backBtn} onClick={() => setStep((step - 1) as Step)}>
              Back
            </button>
          )}
          <button
            className={styles.nextBtn}
            onClick={() => setStep((step + 1) as Step)}
            disabled={step === 0 && !canProceed}
          >
            {step === 2 ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
