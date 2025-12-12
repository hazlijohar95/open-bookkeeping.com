import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";
import { queryClient } from "@/lib/query-client";
import { getAccessToken } from "@/providers/auth-provider";
import type { AppRouter } from "../../../api/src/trpc/router";

export const trpc = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser should use current origin
    return import.meta.env.VITE_API_URL ?? "";
  }
  return "";
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/trpc`,
          transformer: superjson,
          // Use cached token - no async getSession() call
          headers() {
            const token = getAccessToken();
            return {
              Authorization: token ? `Bearer ${token}` : "",
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
