import styles from "./Header.module.css";

export function Header() {
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
          <span className={styles.statusDot} />
          <span className={styles.tagline}>Brand-Aware Generation</span>
        </div>
      </div>
    </header>
  );
}
