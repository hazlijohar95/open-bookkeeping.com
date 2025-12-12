"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon, RefreshCwIcon, SparklesIcon } from "@/components/ui/icons";

// ============================================================================
// TYPES
// ============================================================================

export interface PWAUpdatePromptProps {
  open: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PWAUpdatePrompt({
  open,
  onUpdate,
  onDismiss,
  className,
}: PWAUpdatePromptProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onUpdate();
    } finally {
      // Keep spinning - the page will reload
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
          className={cn(
            "fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md",
            "md:left-auto md:right-4 md:bottom-4",
            "safe-bottom",
            className
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl",
              "bg-gradient-to-br from-primary/95 to-primary",
              "shadow-2xl shadow-primary/25",
              "border border-white/10"
            )}
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 rounded-full blur-3xl"
                animate={{
                  x: [0, 100, 0],
                  y: [0, 50, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            <div className="relative p-4">
              {/* Close button */}
              <button
                onClick={onDismiss}
                className={cn(
                  "absolute top-3 right-3 p-1.5 rounded-full",
                  "text-white/70 hover:text-white hover:bg-white/10",
                  "transition-colors"
                )}
                aria-label="Dismiss"
              >
                <XIcon className="size-4" />
              </button>

              <div className="flex items-start gap-4 pr-8">
                {/* Icon */}
                <div
                  className={cn(
                    "flex-none flex items-center justify-center",
                    "size-12 rounded-xl",
                    "bg-white/15 backdrop-blur-sm"
                  )}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <SparklesIcon className="size-6 text-white" />
                  </motion.div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-base">
                    Update Available
                  </h3>
                  <p className="text-sm text-white/80 mt-0.5">
                    A new version is ready with improvements and fixes.
                  </p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={handleUpdate}
                      disabled={isUpdating}
                      className={cn(
                        "h-9 px-4",
                        "bg-white text-primary",
                        "hover:bg-white/90",
                        "font-medium"
                      )}
                    >
                      {isUpdating ? (
                        <>
                          <RefreshCwIcon className="size-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <RefreshCwIcon className="size-4 mr-2" />
                          Update Now
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onDismiss}
                      className={cn(
                        "h-9 px-4",
                        "text-white/80 hover:text-white",
                        "hover:bg-white/10"
                      )}
                    >
                      Later
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar animation */}
            {isUpdating && (
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-white/30"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAUpdatePrompt;
