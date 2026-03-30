"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { ToastProvider } from "@/components/Toast";
import { SettingsModal } from "@/components/SettingsModal";
import { LoginForm } from "@/components/LoginForm";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { useTunnel } from "@/lib/client/useTunnel";

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
  const [dashboardTab, setDashboardTab] = useState<string | undefined>();
  const tunnelResult = useTunnel();
  const tunnelActive = tunnelResult?.tunnel.status === "active";

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleTunnelClick = useCallback(() => {
    setDashboardTab("connect");
  }, []);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        flexDirection: "column",
        gap: "16px",
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.06)",
          borderTopColor: "#8b5cf6",
          animation: "spin 0.8s linear infinite",
        }} />
        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
          Loading...
        </span>
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
        onTunnelClick={handleTunnelClick}
        showStudioLink
        showAdminLink={isAdmin}
        tunnelActive={tunnelActive}
      />

      <Dashboard initialTab={dashboardTab} />

      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    </>
  );
}
