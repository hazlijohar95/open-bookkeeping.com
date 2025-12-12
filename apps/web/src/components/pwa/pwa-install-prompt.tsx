"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  XIcon,
  DownloadIcon,
  SmartphoneIcon,
  WifiOffIcon,
  ZapIcon,
  CheckIcon,
} from "@/components/ui/icons";

// ============================================================================
// TYPES
// ============================================================================

export interface PWAInstallPromptProps {
  open: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
  className?: string;
}

// ============================================================================
// FEATURES LIST
// ============================================================================

const INSTALL_FEATURES = [
  {
    icon: ZapIcon,
    title: "Lightning Fast",
    description: "Instant loading with offline support",
  },
  {
    icon: WifiOffIcon,
    title: "Works Offline",
    description: "Access your data anytime, anywhere",
  },
  {
    icon: SmartphoneIcon,
    title: "Native Feel",
    description: "Full-screen app experience",
  },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function PWAInstallPrompt({
  open,
  onInstall,
  onDismiss,
  className,
}: PWAInstallPromptProps) {
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [installSuccess, setInstallSuccess] = React.useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const success = await onInstall();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => {
          onDismiss();
        }, 2000);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
            onClick={onDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 35,
            }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[100]",
              "md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:max-w-md md:rounded-2xl",
              className
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden",
                "bg-card",
                "rounded-t-3xl md:rounded-2xl",
                "shadow-2xl",
                "border-t md:border border-border"
              )}
            >
              {/* Handle bar (mobile) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
              </div>

              {/* Close button */}
              <button
                onClick={onDismiss}
                className={cn(
                  "absolute top-4 right-4 p-2 rounded-full",
                  "text-muted-foreground hover:text-foreground",
                  "hover:bg-muted transition-colors"
                )}
                aria-label="Close"
              >
                <XIcon className="size-5" />
              </button>

              <div className="p-6 pt-4 md:pt-6 safe-bottom">
                {installSuccess ? (
                  // Success state
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className={cn(
                        "mx-auto size-16 rounded-full",
                        "bg-green-500/10 flex items-center justify-center",
                        "mb-4"
                      )}
                    >
                      <CheckIcon className="size-8 text-green-500" />
                    </motion.div>
                    <h3 className="text-xl font-semibold">
                      Successfully Installed!
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      Open Bookkeeping is now on your home screen.
                    </p>
                  </motion.div>
                ) : (
                  // Install prompt
                  <>
                    {/* Header */}
                    <div className="text-center mb-6">
                      {/* App icon */}
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={cn(
                          "mx-auto size-20 rounded-2xl",
                          "bg-gradient-to-br from-primary to-primary/80",
                          "flex items-center justify-center",
                          "shadow-lg shadow-primary/25",
                          "mb-4"
                        )}
                      >
                        <svg
                          className="size-10 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                      </motion.div>

                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <h2 className="text-2xl font-bold">
                          Install Open Bookkeeping
                        </h2>
                        <p className="text-muted-foreground mt-2">
                          Add to your home screen for the best experience
                        </p>
                      </motion.div>
                    </div>

                    {/* Features */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-3 mb-6"
                    >
                      {INSTALL_FEATURES.map((feature, index) => (
                        <motion.div
                          key={feature.title}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.3 + index * 0.1 }}
                          className={cn(
                            "flex items-center gap-4 p-3",
                            "bg-muted/50 rounded-xl"
                          )}
                        >
                          <div
                            className={cn(
                              "flex-none size-10 rounded-lg",
                              "bg-primary/10 flex items-center justify-center"
                            )}
                          >
                            <feature.icon className="size-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">
                              {feature.title}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {feature.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-3"
                    >
                      <Button
                        size="lg"
                        onClick={handleInstall}
                        disabled={isInstalling}
                        className={cn("w-full h-14 text-base", "font-semibold")}
                      >
                        {isInstalling ? (
                          <>
                            <div className="size-5 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Installing...
                          </>
                        ) : (
                          <>
                            <DownloadIcon className="size-5 mr-2" />
                            Install App
                          </>
                        )}
                      </Button>
                      <Button
                        size="lg"
                        variant="ghost"
                        onClick={onDismiss}
                        className={cn(
                          "w-full h-12",
                          "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Maybe Later
                      </Button>
                    </motion.div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PWAInstallPrompt;
