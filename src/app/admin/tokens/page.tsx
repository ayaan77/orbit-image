"use client";

import { TokenTable } from "@/components/admin/TokenTable";
import styles from "../page.module.css";

export default function AdminTokensPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>MCP Tokens</h1>
      <TokenTable />
    </div>
  );
}
