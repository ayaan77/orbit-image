import Link from "next/link";
import type { ProviderStatus } from "@/lib/client/useProviderStatus";
import styles from "./Header.module.css";

interface HeaderProps {
  readonly onSettingsClick?: () => void;
  readonly onHistoryClick?: () => void;
  readonly historyCount?: number;
  readonly showStudioLink?: boolean;
  readonly showAdminLink?: boolean;
  readonly providerStatus?: ProviderStatus | null;
}

const PROVIDER_DOTS: { key: "openai" | "replicate" | "xai"; label: string }[] = [
  { key: "openai", label: "OpenAI" },
  { key: "replicate", label: "Replicate" },
  { key: "xai", label: "xAI" },
];

export function Header({
  onSettingsClick,
  onHistoryClick,
  historyCount = 0,
  showStudioLink,
  showAdminLink,
  providerStatus,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <div className={styles.logoGlow} />
            <svg
              className={styles.logoSvg}
              width="24"
              height="24"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="14"
                cy="14"
                r="11"
                stroke="url(#orbit-grad)"
                strokeWidth="2"
              />
              <circle cx="14" cy="14" r="4" fill="url(#orbit-grad)" />
              <ellipse
                cx="14"
                cy="14"
                rx="18"
                ry="6"
                stroke="url(#orbit-grad)"
                strokeWidth="1.5"
                opacity="0.5"
                transform="rotate(-30 14 14)"
              />
              <defs>
                <linearGradient
                  id="orbit-grad"
                  x1="0"
                  y1="0"
                  x2="28"
                  y2="28"
                >
                  <stop stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className={styles.nameGroup}>
            <span className={styles.name}>
              Orbit<span className={styles.nameAccent}>Image</span>
            </span>
            <span className={styles.version}>v1.0</span>
          </div>
        </div>
        <div className={styles.rightGroup}>
          {showAdminLink && (
            <Link href="/admin" className={styles.studioLink}>
              Admin
            </Link>
          )}
          {showStudioLink && (
            <Link href="/studio" className={styles.studioLink}>
              Try Studio
            </Link>
          )}

          {/* Provider status dots */}
          {providerStatus && (
            <div className={styles.providerDots} aria-label="Provider status">
              {PROVIDER_DOTS.map(({ key, label }) => (
                <span
                  key={key}
                  className={`${styles.providerDot} ${
                    providerStatus.providers[key].configured
                      ? styles.providerDotActive
                      : styles.providerDotInactive
                  }`}
                  style={
                    providerStatus.providers[key].configured
                      ? { backgroundColor: `var(--provider-${key})` }
                      : undefined
                  }
                  title={`${label}: ${providerStatus.providers[key].configured ? "Connected" : "Not configured"}`}
                  aria-label={`${label} ${providerStatus.providers[key].configured ? "connected" : "not configured"}`}
                />
              ))}
            </div>
          )}

          {onHistoryClick && (
            <button
              className={styles.iconBtn}
              onClick={onHistoryClick}
              aria-label="View generation history"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {historyCount > 0 && (
                <span className={styles.historyBadge}>{historyCount}</span>
              )}
            </button>
          )}
          {onSettingsClick && (
            <button
              className={`${styles.iconBtn} ${styles.settingsBtn}`}
              onClick={onSettingsClick}
              aria-label="Open settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <span className={styles.statusDot} />
          <span className={styles.tagline}>Brand-Aware Generation</span>
        </div>
      </div>
    </header>
  );
}
