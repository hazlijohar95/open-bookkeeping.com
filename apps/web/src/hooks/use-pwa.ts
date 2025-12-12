"use client";

import { useState, useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// ============================================================================
// MOBILE DETECTION
// ============================================================================

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  // Check for mobile user agent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(navigator.userAgent);

  // Check for touch capability + small screen (tablets with keyboard excluded)
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;

  return isMobileUA || (isTouchDevice && isSmallScreen);
}

// ============================================================================
// TYPES
// ============================================================================

export interface PWAStatus {
  // Device Status
  isMobile: boolean;

  // Service Worker Status
  isOnline: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  needRefresh: boolean;
  offlineReady: boolean;

  // Install Prompt
  canInstall: boolean;
  installPromptEvent: BeforeInstallPromptEvent | null;

  // Actions
  updateServiceWorker: () => Promise<void>;
  installApp: () => Promise<boolean>;
  dismissInstallPrompt: () => void;
  dismissUpdatePrompt: () => void;
}

// BeforeInstallPromptEvent type (not in standard TypeScript lib)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  INSTALL_DISMISSED: "pwa-install-dismissed",
  INSTALL_DISMISSED_DATE: "pwa-install-dismissed-date",
  LAST_UPDATE_CHECK: "pwa-last-update-check",
} as const;

// ============================================================================
// HOOK
// ============================================================================

export function usePWA(): PWAStatus {
  // Check if mobile device - PWA only enabled on mobile
  const [isMobile] = useState(() => isMobileDevice());

  // Online/Offline status
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Install prompt state
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  // Check if app is installed (standalone mode)
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS Safari specific
      window.navigator.standalone === true);

  // Check if PWA is installed (has service worker)
  const isInstalled =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;

  // Unregister service worker on desktop to prevent caching issues
  useEffect(() => {
    if (!isMobile && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
          console.log("[PWA] Service worker unregistered on desktop");
        }
      });
    }
  }, [isMobile]);

  // Register service worker with vite-plugin-pwa (mobile only)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, _setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // Only register on mobile
    immediate: isMobile,
    onRegisteredSW(swUrl, registration) {
      if (!isMobile) {
        // Unregister immediately on desktop
        registration?.unregister();
        return;
      }

      // Check for updates every hour (mobile only)
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }

      console.log("[PWA] Service worker registered:", swUrl);
    },
    onRegisterError(error) {
      console.error("[PWA] Service worker registration error:", error);
    },
  });

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Handle install prompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();

      // Check if user dismissed the prompt recently (within 7 days)
      const dismissedDate = localStorage.getItem(
        STORAGE_KEYS.INSTALL_DISMISSED_DATE
      );
      if (dismissedDate) {
        const daysSinceDismissed =
          (Date.now() - parseInt(dismissedDate, 10)) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          return;
        }
      }

      // Store the event for later use
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setCanInstall(false);
      console.log("[PWA] App installed successfully");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Install app function
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!installPromptEvent) {
      return false;
    }

    try {
      // Show the install prompt
      await installPromptEvent.prompt();

      // Wait for the user's response
      const { outcome } = await installPromptEvent.userChoice;

      if (outcome === "accepted") {
        console.log("[PWA] User accepted the install prompt");
        setInstallPromptEvent(null);
        setCanInstall(false);
        return true;
      } else {
        console.log("[PWA] User dismissed the install prompt");
        return false;
      }
    } catch (error) {
      console.error("[PWA] Error showing install prompt:", error);
      return false;
    }
  }, [installPromptEvent]);

  // Dismiss install prompt (remember for 7 days)
  const dismissInstallPrompt = useCallback(() => {
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, "true");
    localStorage.setItem(
      STORAGE_KEYS.INSTALL_DISMISSED_DATE,
      Date.now().toString()
    );
    setCanInstall(false);
    setInstallPromptEvent(null);
  }, []);

  // Dismiss update prompt
  const dismissUpdatePrompt = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  // Handle update
  const handleUpdate = useCallback(async () => {
    await updateServiceWorker(true);
  }, [updateServiceWorker]);

  return {
    isMobile,
    isOnline,
    isInstalled,
    isStandalone,
    needRefresh: isMobile ? needRefresh : false,
    offlineReady: isMobile ? offlineReady : false,
    canInstall: isMobile ? canInstall : false,
    installPromptEvent: isMobile ? installPromptEvent : null,
    updateServiceWorker: handleUpdate,
    installApp,
    dismissInstallPrompt,
    dismissUpdatePrompt,
  };
}

export default usePWA;
