"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { WifiOffIcon } from "@/components/ui/icons";

// ============================================================================
// TYPES
// ============================================================================

export interface PWAOfflineIndicatorProps {
  isOffline: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PWAOfflineIndicator({
  isOffline,
  className,
}: PWAOfflineIndicatorProps) {
  const [showReconnecting, setShowReconnecting] = React.useState(false);

  // Show reconnecting message when coming back online
  React.useEffect(() => {
    if (!isOffline) {
      setShowReconnecting(true);
      const timer = setTimeout(() => setShowReconnecting(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOffline]);

  const shouldShow = isOffline || showReconnecting;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100]",
            "safe-top",
            className
          )}
        >
          <div
            className={cn(
              "mx-auto max-w-md px-4 py-2",
              "flex items-center justify-center gap-2",
              isOffline
                ? "bg-amber-500 text-amber-950"
                : "bg-green-500 text-green-950"
            )}
          >
            {isOffline ? (
              <>
                <WifiOffIcon className="size-4" />
                <span className="text-sm font-medium">
                  You're offline. Some features may be limited.
                </span>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="size-4 rounded-full bg-green-950/20 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="size-2 rounded-full bg-green-950"
                  />
                </motion.div>
                <span className="text-sm font-medium">Back online!</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAOfflineIndicator;
