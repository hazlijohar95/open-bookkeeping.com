import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/data/auth";
import { getApiUrl } from "@/lib/api-url";

export function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { session, error: sessionError } = await authService.getSession();

        if (sessionError || !session) {
          console.error("Auth callback error:", sessionError);
          setStatus("error");
          setMessage("Authentication failed. Redirecting...");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        const accessToken = session.access_token;
        setMessage("Setting up your account...");

        // Check onboarding status
        const onboardingResponse = await fetch(`${getApiUrl()}/trpc/subscription.getOnboardingStatus`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        const onboardingResult = await onboardingResponse.json();
        const onboardingStatus = onboardingResult?.result?.data;

        // If no onboarding record exists, initialize new user
        if (!onboardingStatus) {
          setMessage("Welcome! Preparing your trial...");

          // Initialize new user (creates subscription + onboarding records)
          await fetch(`${getApiUrl()}/trpc/subscription.initializeNewUser`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });

          // Redirect to onboarding
          setStatus("success");
          setMessage("Let's get you set up!");
          setTimeout(() => navigate("/onboarding"), 500);
          return;
        }

        // If onboarding exists but not completed, redirect to onboarding
        if (!onboardingStatus.isCompleted && !onboardingStatus.wasSkipped) {
          setStatus("success");
          setMessage("Continuing setup...");
          setTimeout(() => navigate("/onboarding"), 500);
          return;
        }

        // Onboarding completed, go to dashboard
        setStatus("success");
        setMessage("Welcome back!");
        setTimeout(() => navigate("/invoices"), 500);

      } catch (error) {
        console.error("Auth callback error:", error);
        setStatus("error");
        setMessage("Something went wrong. Redirecting...");
        setTimeout(() => navigate("/"), 2000);
      }
    };

    void handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {status === "loading" && (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        )}
        {status === "success" && (
          <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {status === "error" && (
          <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
