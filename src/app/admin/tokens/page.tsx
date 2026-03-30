"use client";

import { TokenTable } from "@/components/admin/TokenTable";
import styles from "../page.module.css";

export default function AdminTokensPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>MCP Tokens</h1>
      <p className={styles.subtitle}>
        Create and manage tokens for your team&apos;s AI clients. Share a token with any teammate or app that needs access to Orbit Image.
      </p>
      <TokenTable />
    </div>
  );
}
