"use client";

import { UserTable } from "@/components/admin/UserTable";
import styles from "../page.module.css";

export default function AdminUsersPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Users</h1>
      <UserTable />
    </div>
  );
}
