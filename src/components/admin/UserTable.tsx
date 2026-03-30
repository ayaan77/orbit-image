"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/client/api";
import { useToast } from "@/components/Toast";
import styles from "./UserTable.module.css";

interface User {
  readonly id: string;
  readonly username: string;
  readonly email?: string;
  readonly role: "admin" | "user";
  readonly rate_limit?: number;
  readonly budget?: number;
  readonly active: boolean;
  readonly created_at: string;
}

interface UserFormState {
  username: string;
  password: string;
  role: "admin" | "user";
  email: string;
}

interface EditFormState {
  role: "admin" | "user";
  email: string;
  rate_limit: string;
  budget: string;
}

const EMPTY_FORM: UserFormState = {
  username: "",
  password: "",
  role: "user",
  email: "",
};

export function UserTable() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<readonly User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ role: "user", email: "", rate_limit: "", budget: "" });
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/users?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users ?? data.data ?? []);
      setTotal(data.meta?.total ?? data.total ?? 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate() {
    if (!createForm.username || !createForm.password) {
      showToast("Username and password are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: createForm.username,
          password: createForm.password,
          role: createForm.role,
          email: createForm.email || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Create failed");
      }
      showToast("User created", "success");
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Create failed";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(userId: string) {
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: editForm.role,
          email: editForm.email || undefined,
          rate_limit: editForm.rate_limit ? Number(editForm.rate_limit) : undefined,
          budget: editForm.budget ? Number(editForm.budget) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Update failed");
      }
      showToast("User updated", "success");
      setEditingId(null);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(userId: string, username: string) {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showToast("User deleted", "success");
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      showToast(message, "error");
    }
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !currentActive }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      showToast(`User ${currentActive ? "deactivated" : "activated"}`, "success");
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Toggle failed";
      showToast(message, "error");
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({
      role: user.role,
      email: user.email ?? "",
      rate_limit: user.rate_limit != null ? String(user.rate_limit) : "",
      budget: user.budget != null ? String(user.budget) : "",
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (loading) return <div className={styles.loading}>Loading users...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "Cancel" : "+ Create User"}
        </button>
      </div>

      {showCreate && (
        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Username *</label>
            <input
              className={styles.formInput}
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              placeholder="username"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Password *</label>
            <input
              className={styles.formInput}
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="password"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Role</label>
            <select
              className={styles.formSelect}
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as "admin" | "user" })}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email (optional)</label>
            <input
              className={styles.formInput}
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div className={styles.formActions}>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {users.length === 0 ? (
        <div className={styles.empty}>No users found</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Rate Limit</th>
                <th>Budget</th>
                <th>Active</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) =>
                editingId === user.id ? (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      <select
                        className={styles.formSelect}
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "admin" | "user" })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className={styles.formInput}
                        type="number"
                        value={editForm.rate_limit}
                        onChange={(e) => setEditForm({ ...editForm, rate_limit: e.target.value })}
                        placeholder="60"
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.formInput}
                        type="number"
                        value={editForm.budget}
                        onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                        placeholder="100"
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>{user.active ? "Yes" : "No"}</td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                          onClick={() => handleUpdate(user.id)}
                          disabled={submitting}
                        >
                          Save
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      <span className={`${styles.badge} ${user.role === "admin" ? styles.badgeAdmin : styles.badgeUser}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.rate_limit ?? "--"}</td>
                    <td>{user.budget != null ? `$${user.budget}` : "--"}</td>
                    <td>
                      <button
                        className={`${styles.badge} ${user.active ? styles.badgeActive : styles.badgeInactive}`}
                        onClick={() => handleToggleActive(user.id, user.active)}
                        style={{ cursor: "pointer", border: "none", background: "inherit" }}
                      >
                        {user.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                          onClick={() => handleDelete(user.id, user.username)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
