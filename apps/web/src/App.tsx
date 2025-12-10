import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { Toaster } from "sonner";
import { router } from "./router";
import { queryClient } from "./lib/query-client";
import { TRPCProvider } from "./trpc/provider";
import { ThemeProvider } from "./providers/theme-provider";
import { AuthProvider } from "./providers/auth-provider";
import { PostHogProvider } from "./providers/posthog-provider";

export function App() {
  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider>
          <AuthProvider>
            <PostHogProvider>
              <ThemeProvider defaultTheme="light" storageKey="open-bookkeeping-theme">
                <RouterProvider router={router} />
                <Toaster richColors position="top-right" />
              </ThemeProvider>
            </PostHogProvider>
          </AuthProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </JotaiProvider>
  );
}
