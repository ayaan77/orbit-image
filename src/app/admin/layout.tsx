"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import styles from "./layout.module.css";

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/admin", label: "Overview", icon: "\u25A3" },
  { href: "/admin/users", label: "Users", icon: "\u263A" },
  { href: "/admin/tokens", label: "Tokens", icon: "\u26BF" },
  { href: "/admin/usage", label: "Usage", icon: "\u2261" },
];

function AdminGate({ children }: { readonly children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className={styles.centered}>
        <span className={styles.deniedIcon}>{"\u26D4"}</span>
        <span className={styles.denied}>Access denied. Admin privileges required.</span>
      </div>
    );
  }

  return <>{children}</>;
}

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>O</div>
        <span className={styles.logoText}>Orbit Admin</span>
      </div>
      <nav className={styles.nav}>
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
    </aside>
  );
}

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
