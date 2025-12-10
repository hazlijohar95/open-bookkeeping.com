import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,        // Consider data stale after 10 minutes (invoices don't change that fast)
      gcTime: 15 * 60 * 1000,           // Keep unused data in cache for 15 minutes
      refetchOnWindowFocus: false,      // Don't refetch on window focus - causes unnecessary requests
      refetchOnMount: false,            // Use cached data if available - critical for fast navigation
      refetchOnReconnect: false,        // Don't auto-refetch on reconnect
      retry: 1,                         // Retry failed requests once
    },
  },
});
