"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { XIcon, AlertCircleIcon } from "@/components/ui/icons";
import { trpc } from "@/trpc/provider";

export function FreeTierBanner() {
  const [isDismissed, setIsDismissed] = useState(() => {
    // Check localStorage for dismissal
    const dismissed = localStorage.getItem("free-tier-banner-dismissed");
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const now = new Date();
      // Re-show after 7 days
      const daysSinceDismissed = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceDismissed < 7;
    }
    return false;
  });

  const { data: subscription, isLoading } = trpc.subscription.getSubscription.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("free-tier-banner-dismissed", new Date().toISOString());
  };

  // Show only if:
  // - Not loading
  // - Not dismissed
  // - Has subscription
  // - Trial is NOT active (expired) AND plan is still "trial" (meaning they haven't upgraded)
  const showBanner =
    !isLoading &&
    !isDismissed &&
    subscription &&
    !subscription.isTrialActive &&
    subscription.plan === "trial";

  if (!showBanner) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-muted/80 via-muted/50 to-muted/80 border-b border-border"
      >
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircleIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm">
              <span className="font-medium">Your trial has ended.</span>{" "}
              <span className="text-muted-foreground">
                You're now on the free tier with limited features. Upgrade to unlock full access.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              disabled
            >
              Upgrade (Coming Soon)
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default FreeTierBanner;
