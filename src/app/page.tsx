"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { ToastProvider } from "@/components/Toast";
import { SettingsModal } from "@/components/SettingsModal";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { hasApiKey } from "@/lib/client/storage";
import { useProviderStatus } from "@/lib/client/useProviderStatus";

export default function Home() {
  return (
    <ToastProvider>
      <HomeContent />
    </ToastProvider>
  );
}

function HomeContent() {
  const [apiKeyPresent, setApiKeyPresent] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { status: providerStatus, refresh: refreshProviders } = useProviderStatus();

  useEffect(() => {
    setApiKeyPresent(hasApiKey());
  }, []);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
    const keyPresent = hasApiKey();
    setApiKeyPresent(keyPresent);
    if (keyPresent) {
      refreshProviders();
    }
  }, [refreshProviders]);

  return (
    <>
      <Header
        onSettingsClick={() => setSettingsOpen(true)}
        showStudioLink
        providerStatus={providerStatus}
      />

      {apiKeyPresent ? (
        <Dashboard />
      ) : (
        <ApiKeyGate onKeySet={() => setApiKeyPresent(true)} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
    </>
  );
}
