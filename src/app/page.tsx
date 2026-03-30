"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { ToastProvider } from "@/components/Toast";
import { SettingsModal } from "@/components/SettingsModal";
import { LoginForm } from "@/components/LoginForm";
import { AuthProvider, useAuth } from "@/components/AuthProvider";

export default function Home() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HomeContent />
      </AuthProvider>
    </ToastProvider>
  );
}

function HomeContent() {
  const { user, loading, isAdmin } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <>
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        showStudioLink
        showAdminLink={isAdmin}
      />

      <Dashboard />

      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    </>
  );
}
