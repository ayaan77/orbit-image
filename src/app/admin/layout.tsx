"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import styles from "./layout.module.css";

/* ─── SVG Icon Components ─── */

function GridIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="10.5" y="2" width="5.5" height="5.5" rx="1" />
      <rect x="2" y="10.5" width="5.5" height="5.5" rx="1" />
      <rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="5.5" r="2.5" />
      <path d="M2 15.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5" />
      <circle cx="13" cy="6" r="2" />
      <path d="M13.5 11c1.5.3 2.5 1.5 2.5 3" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11.5" cy="6.5" r="3.5" />
      <path d="M9 9L3 15" />
      <path d="M3 15l2.5 0" />
      <path d="M3 15l0-2.5" />
      <path d="M6 12l0-2" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2 2 0 002-2c0-.53-.2-1-.55-1.35-.35-.38-.55-.83-.55-1.35a2 2 0 012-2h2.35c3.27 0 5.94-2.5 5.94-5.58C21.29 5.93 17.22 2 12 2z" />
      <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" />
      <circle cx="10.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="10" width="3" height="6" rx="0.5" />
      <rect x="7.5" y="6" width="3" height="10" rx="0.5" />
      <rect x="13" y="2" width="3" height="14" rx="0.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 10.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1" />
      <path d="M10.5 7.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4L6 9l5 5" />
    </svg>
  );
}

function ShieldXIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7 4v5c0 5-3.5 8.7-7 10-3.5-1.3-7-5-7-10V6l7-4z" />
      <path d="M9.5 9.5l5 5" />
      <path d="M14.5 9.5l-5 5" />
    </svg>
  );
}

/* ─── Nav Item Type & Data ─── */

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: <GridIcon /> },
  { href: "/admin/users", label: "Users", icon: <UsersIcon /> },
  { href: "/admin/tokens", label: "Tokens", icon: <KeyIcon /> },
  { href: "/admin/brands", label: "Brands", icon: <PaletteIcon /> },
  { href: "/admin/usage", label: "Usage", icon: <ChartIcon /> },
  { href: "/admin/connect", label: "Connect", icon: <LinkIcon /> },
];

/* ─── Admin Gate ─── */

function AdminGate({ children }: { readonly children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          Loading admin...
        </span>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className={styles.centered}>
        <div className={styles.deniedIcon}>
          <ShieldXIcon />
        </div>
        <span className={styles.denied}>Access denied. Admin privileges required.</span>
      </div>
    );
  }

  return <>{children}</>;
}

/* ─── Sidebar ─── */

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoSection}>
        <Link href="/admin" className={styles.logoLink}>
          <div className={styles.logoIcon}>O</div>
          <div className={styles.logoTextGroup}>
            <span className={styles.logoText}>Orbit Admin</span>
            <span className={styles.versionBadge}>v1.0</span>
          </div>
        </Link>
      </div>

      <div className={styles.divider} />

      {/* Navigation */}
      <nav className={styles.nav}>
        <span className={styles.navLabel}>Navigation</span>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={styles.divider} />
      <div className={styles.bottomSection}>
        <Link href="/" className={styles.backLink}>
          <span className={styles.backIcon}>
            <ArrowLeftIcon />
          </span>
          Back to App
        </Link>
      </div>
    </aside>
  );
}

/* ─── Layout ─── */

export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AdminGate>
          <div className={styles.wrapper}>
            <Sidebar />
            <main className={styles.main}>{children}</main>
          </div>
        </AdminGate>
      </ToastProvider>
    </AuthProvider>
  );
}
