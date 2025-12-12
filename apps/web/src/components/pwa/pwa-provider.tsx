"use client";

import * as React from "react";
import { usePWA } from "@/hooks/use-pwa";
import { PWAUpdatePrompt } from "./pwa-update-prompt";
import { PWAInstallPrompt } from "./pwa-install-prompt";
import { PWAOfflineIndicator } from "./pwa-offline-indicator";

// ============================================================================
// TYPES
// ============================================================================

export interface PWAProviderProps {
  children: React.ReactNode;
  showInstallPrompt?: boolean;
  showUpdatePrompt?: boolean;
  showOfflineIndicator?: boolean;
  installPromptDelay?: number; // Delay before showing install prompt (ms)
}

// ============================================================================
// CONTEXT
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

export function usePWAContext() {
  const context = React.useContext(PWAContext);
  if (!context) {
    throw new Error("usePWAContext must be used within a PWAProvider");
  }
  return context;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PWAProvider({
  children,
  showInstallPrompt: enableInstallPrompt = true,
  showUpdatePrompt: enableUpdatePrompt = true,
  showOfflineIndicator: enableOfflineIndicator = true,
  installPromptDelay = 30000, // 30 seconds default
}: PWAProviderProps) {
  const pwa = usePWA();
  const [showInstallModal, setShowInstallModal] = React.useState(false);
  const installPromptShownRef = React.useRef(false);

  // Auto-show install prompt after delay (only once per session)
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

  // Handle install
  const handleInstall = async () => {
    const success = await pwa.installApp();
    if (success) {
      setShowInstallModal(false);
    }
    return success;
  };

  // Handle install dismiss
  const handleInstallDismiss = () => {
    setShowInstallModal(false);
    pwa.dismissInstallPrompt();
  };

  // Manual trigger for install prompt
  const triggerInstallPrompt = React.useCallback(() => {
    if (pwa.canInstall) {
      setShowInstallModal(true);
    }
  }, [pwa.canInstall]);

  // Context value
  const contextValue: PWAContextValue = {
    isMobile: pwa.isMobile,
    isOnline: pwa.isOnline,
    isStandalone: pwa.isStandalone,
    isInstalled: pwa.isInstalled,
    canInstall: pwa.canInstall,
    showInstallPrompt: triggerInstallPrompt,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

      {/* PWA UI only shown on mobile devices */}
      {pwa.isMobile && (
        <>
          {/* Offline Indicator */}
          {enableOfflineIndicator && (
            <PWAOfflineIndicator isOffline={!pwa.isOnline} />
          )}

          {/* Update Prompt */}
          {enableUpdatePrompt && (
            <PWAUpdatePrompt
              open={pwa.needRefresh}
              onUpdate={pwa.updateServiceWorker}
              onDismiss={pwa.dismissUpdatePrompt}
            />
          )}

          {/* Install Prompt */}
          {enableInstallPrompt && (
            <PWAInstallPrompt
              open={showInstallModal}
              onInstall={handleInstall}
              onDismiss={handleInstallDismiss}
            />
          )}
        </>
      )}
    </PWAContext.Provider>
  );
}

export default PWAProvider;
