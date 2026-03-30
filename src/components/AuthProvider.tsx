"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";

interface AuthUser {
  readonly id: string;
  readonly username: string;
  readonly email?: string;
  readonly role: "admin" | "user";
}

interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly loading: boolean;
  readonly isAdmin: boolean;
  readonly login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  readonly logout: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.error?.message || "Login failed" };
    } catch {
      return { success: false, error: "Network error" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Ignore errors — clear local state regardless
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAdmin: user?.role === "admin",
    login,
    logout,
    refresh,
  }), [user, loading, login, logout, refresh]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
