"use client";

import { UsagePanel } from "@/components/UsagePanel";
import styles from "../page.module.css";

export default function AdminUsagePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Usage</h1>
      <UsagePanel />
    </div>
  );
}
