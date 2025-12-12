import type { ReactNode } from "react";
import { useEffect, createContext, useContext } from "react";
import posthog from "posthog-js";
import { useAuth } from "./auth-provider";

// Initialize PostHog
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (POSTHOG_KEY && typeof window !== "undefined") {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    // Respect Do Not Track
    respect_dnt: true,
    // Disable in development
    loaded: (posthog) => {
      if (import.meta.env.DEV) {
        posthog.debug();
      }
    },
  });
}

interface PostHogContextType {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
}

const PostHogContext = createContext<PostHogContextType | undefined>(undefined);

export function PostHogProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Identify user when they log in
  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name ?? user.user_metadata?.name,
        avatar_url: user.user_metadata?.avatar_url,
        provider: user.app_metadata?.provider,
        created_at: user.created_at,
      });
    } else {
      // Reset when user logs out
      posthog.reset();
    }
  }, [user]);

  const capture = (event: string, properties?: Record<string, unknown>) => {
    posthog.capture(event, properties);
  };

  const identify = (userId: string, properties?: Record<string, unknown>) => {
    posthog.identify(userId, properties);
  };

  const reset = () => {
    posthog.reset();
  };

  return (
    <PostHogContext.Provider value={{ capture, identify, reset }}>
      {children}
    </PostHogContext.Provider>
  );
}

export function usePostHog() {
  const context = useContext(PostHogContext);
  if (context === undefined) {
    throw new Error("usePostHog must be used within a PostHogProvider");
  }
  return context;
}

// Re-export posthog for direct access if needed
export { posthog };
