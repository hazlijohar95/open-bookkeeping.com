"use client";

import * as React from "react";
import { usePWA } from "@/hooks/use-pwa";
import { PWAUpdatePrompt } from "./pwa-update-prompt";
import { PWAInstallPrompt } from "./pwa-install-prompt";
import { PWAOfflineIndicator } from "./pwa-offline-indicator";
import type { PWAProviderProps } from "./pwa-provider";

// ============================================================================
// CONTEXT (shared with main provider)
// ============================================================================

interface PWAContextValue {
  isMobile: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  showInstallPrompt: () => void;
}

const PWAContext = React.createContext<PWAContextValue | null>(null);

// ============================================================================
// MOBILE PROVIDER (full PWA support with service worker)
// ============================================================================

export default function PWAProviderMobile({
  children,
  showInstallPrompt: enableInstallPrompt = true,
  showUpdatePrompt: enableUpdatePrompt = true,
  showOfflineIndicator: enableOfflineIndicator = true,
  installPromptDelay = 30000,
}: PWAProviderProps) {
  const pwa = usePWA();
  const [showInstallModal, setShowInstallModal] = React.useState(false);
  const installPromptShownRef = React.useRef(false);

  React.useEffect(() => {
    if (
      !enableInstallPrompt ||
      !pwa.canInstall ||
      pwa.isStandalone ||
      installPromptShownRef.current
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (pwa.canInstall && !pwa.isStandalone) {
        setShowInstallModal(true);
        installPromptShownRef.current = true;
      }
    }, installPromptDelay);

    return () => clearTimeout(timer);
  }, [pwa.canInstall, pwa.isStandalone, enableInstallPrompt, installPromptDelay]);

  const handleInstall = async () => {
    const success = await pwa.installApp();
    if (success) {
      setShowInstallModal(false);
    }
    return success;
  };

  const handleInstallDismiss = () => {
    setShowInstallModal(false);
    pwa.dismissInstallPrompt();
  };

  const triggerInstallPrompt = React.useCallback(() => {
    if (pwa.canInstall) {
      setShowInstallModal(true);
    }
  }, [pwa.canInstall]);

  const contextValue: PWAContextValue = {
    isMobile: true,
    isOnline: pwa.isOnline,
    isStandalone: pwa.isStandalone,
    isInstalled: pwa.isInstalled,
    canInstall: pwa.canInstall,
    showInstallPrompt: triggerInstallPrompt,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

      {enableOfflineIndicator && (
        <PWAOfflineIndicator isOffline={!pwa.isOnline} />
      )}

      {enableUpdatePrompt && (
        <PWAUpdatePrompt
          open={pwa.needRefresh}
          onUpdate={pwa.updateServiceWorker}
          onDismiss={pwa.dismissUpdatePrompt}
        />
      )}

      {enableInstallPrompt && (
        <PWAInstallPrompt
          open={showInstallModal}
          onInstall={handleInstall}
          onDismiss={handleInstallDismiss}
        />
      )}
    </PWAContext.Provider>
  );
}
