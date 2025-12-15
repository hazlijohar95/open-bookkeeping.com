"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { XIcon, Sparkles, ClockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/provider";

export function TrialBanner() {
  const [isDismissed, setIsDismissed] = useState(() => {
    // Check localStorage for dismissal
    const dismissed = localStorage.getItem("trial-banner-dismissed");
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const now = new Date();
      // Re-show after 24 hours
      const hoursSinceDismissed = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceDismissed < 24;
    }
    return false;
  });

  const { data: subscription, isLoading } = trpc.subscription.getSubscription.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("trial-banner-dismissed", new Date().toISOString());
  };

  // Don't show if loading, dismissed, or not on trial
  if (isLoading || isDismissed || !subscription?.isTrialActive) {
    return null;
  }

  const daysRemaining = subscription.trialDaysRemaining;
  const isUrgent = daysRemaining <= 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={cn(
          "relative overflow-hidden",
          isUrgent
            ? "bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-orange-500/10 border-b border-orange-500/20"
            : "bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20"
        )}
      >
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isUrgent ? (
              <ClockIcon className="h-4 w-4 text-orange-500 shrink-0" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
            )}
            <p className="text-sm">
              {isUrgent ? (
                <>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {daysRemaining === 0 ? "Last day" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`}
                  </span>
                  {" "}of your free trial.{" "}
                </>
              ) : (
                <>
                  You have{" "}
                  <span className="font-medium">
                    {daysRemaining} day{daysRemaining === 1 ? "" : "s"}
                  </span>{" "}
                  left in your free trial.{" "}
                </>
              )}
              <span className="text-muted-foreground">Enjoying full access to all features.</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 text-xs",
                isUrgent
                  ? "border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                  : "border-primary/30 text-primary hover:bg-primary/10"
              )}
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

export default TrialBanner;
