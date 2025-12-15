"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { trpc } from "@/trpc/provider";
import { OnboardingChat } from "@/components/onboarding";
import { PageLoadingSpinner } from "@/components/ui/page-loading-spinner";

export default function Onboarding() {
  const navigate = useNavigate();
  const { session, isLoading: authLoading } = useAuth();

  const { data: onboardingStatus, isLoading: statusLoading } = trpc.subscription.getOnboardingStatus.useQuery(
    undefined,
    { enabled: !!session }
  );

  const skipOnboardingMutation = trpc.subscription.skipOnboarding.useMutation({
    onSuccess: () => {
      void navigate("/invoices");
    },
  });

  // Redirect if already completed onboarding
  useEffect(() => {
    if (!statusLoading && onboardingStatus?.isCompleted) {
      void navigate("/invoices");
    }
  }, [onboardingStatus, statusLoading, navigate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !session) {
      void navigate("/login");
    }
  }, [authLoading, session, navigate]);

  const handleComplete = () => {
    void navigate("/invoices");
  };

  const handleSkip = () => {
    skipOnboardingMutation.mutate();
  };

  // Show loading while checking status
  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PageLoadingSpinner />
      </div>
    );
  }

  // Don't render if not authenticated or already completed
  if (!session || onboardingStatus?.isCompleted) {
    return null;
  }

  return (
    <OnboardingChat
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
