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

  // Aggressively unregister service workers and clear caches on desktop
  React.useEffect(() => {
    async function cleanupServiceWorkers() {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        return;
      }

      try {
        // Unregister all service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log("[PWA] Unregistered service worker:", registration.scope);
        }

        // Clear all caches
        if ("caches" in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
            console.log("[PWA] Deleted cache:", cacheName);
          }
        }

        // If we had service workers, reload to ensure clean state
        if (registrations.length > 0) {
          console.log("[PWA] Service workers cleaned up, reloading...");
          // Only reload once - check flag in sessionStorage
          const hasReloaded = sessionStorage.getItem("pwa_cleanup_reload");
          if (!hasReloaded) {
            sessionStorage.setItem("pwa_cleanup_reload", "true");
            window.location.reload();
          }
        }
      } catch (error) {
        console.warn("[PWA] Error cleaning up service workers:", error);
      }
    }

    void cleanupServiceWorkers();
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
