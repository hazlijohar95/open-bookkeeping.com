"use client";

import * as React from "react";

// ============================================================================
// MOBILE DETECTION
// ============================================================================

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(navigator.userAgent);
}

// ============================================================================
// TYPES
// ============================================================================

export interface PWAProviderProps {
  children: React.ReactNode;
  showInstallPrompt?: boolean;
  showUpdatePrompt?: boolean;
  showOfflineIndicator?: boolean;
  installPromptDelay?: number;
}

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
// DESKTOP PROVIDER (no service worker, just passthrough)
// ============================================================================

function PWAProviderDesktop({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Unregister any existing service workers on desktop
  React.useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    }
  }, []);

  // Online/offline events
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const contextValue: PWAContextValue = {
    isMobile: false,
    isOnline,
    isStandalone: false,
    isInstalled: false,
    canInstall: false,
    showInstallPrompt: () => {},
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
    </PWAContext.Provider>
  );
}

// ============================================================================
// MOBILE PROVIDER (lazy loaded to avoid SW registration on desktop)
// ============================================================================

const PWAProviderMobile = React.lazy(() => import("./pwa-provider-mobile"));

// ============================================================================
// MAIN PROVIDER (chooses mobile or desktop)
// ============================================================================

export function PWAProvider(props: PWAProviderProps) {
  const [isMobile] = React.useState(() => isMobileDevice());

  if (isMobile) {
    return (
      <React.Suspense fallback={props.children}>
        <PWAProviderMobile {...props} />
      </React.Suspense>
    );
  }

  return <PWAProviderDesktop>{props.children}</PWAProviderDesktop>;
}

export default PWAProvider;
