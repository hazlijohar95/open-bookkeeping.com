/**
 * Data Prefetch Hook
 * Prefetches commonly needed data when user is authenticated
 * This significantly improves perceived performance by loading data in the background
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { dashboardKeys } from "@/api/dashboard";
import { invoiceKeys } from "@/api/invoices";
import { customerKeys } from "@/api/customers";
import { vendorKeys } from "@/api/vendors";
import { billKeys } from "@/api/bills";
import { quotationKeys } from "@/api/quotations";

// Cache config for prefetched data
const prefetchConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 15 * 60 * 1000,   // 15 minutes
};

/**
 * Prefetches commonly used data in parallel when the user navigates to the app.
 * This hook should be called once in the authenticated layout.
 */
export function useDataPrefetch() {
  const queryClient = useQueryClient();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    // Only prefetch once per session
    if (hasPrefetched.current) return;
    hasPrefetched.current = true;

    // Run prefetch after a short delay to not block initial render
    const timeoutId = setTimeout(() => {
      void prefetchCriticalData(queryClient);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [queryClient]);
}

/**
 * Prefetches critical data in parallel
 * These are the most commonly accessed endpoints
 */
async function prefetchCriticalData(queryClient: ReturnType<typeof useQueryClient>) {
  // Prefetch in parallel - don't await sequentially
  const prefetchPromises = [
    // Dashboard stats (most visited page)
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.stats(),
      queryFn: () => api.get("/dashboard/stats"),
      ...prefetchConfig,
    }),

    // Invoice status breakdown (dashboard)
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.invoiceStatus(),
      queryFn: () => api.get("/dashboard/invoice-status"),
      ...prefetchConfig,
    }),

    // Recent invoices (dashboard)
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.recentInvoices(5),
      queryFn: () => api.get("/dashboard/recent-invoices", { limit: 5 }),
      ...prefetchConfig,
    }),

    // Customer list (frequently accessed)
    queryClient.prefetchQuery({
      queryKey: customerKeys.list({ limit: 50 }),
      queryFn: () => api.get("/customers", { limit: 50 }),
      ...prefetchConfig,
    }),

    // Vendor list (frequently accessed)
    queryClient.prefetchQuery({
      queryKey: vendorKeys.list({ limit: 50 }),
      queryFn: () => api.get("/vendors", { limit: 50 }),
      ...prefetchConfig,
    }),
  ];

  try {
    await Promise.allSettled(prefetchPromises);
  } catch {
    // Silently fail - prefetch errors shouldn't affect the user
  }
}

/**
 * Hook for route-based prefetching
 * Call this to prefetch data for a specific route before navigation
 */
export function usePrefetchRoute() {
  const queryClient = useQueryClient();

  return {
    prefetchInvoices: () => {
      void queryClient.prefetchQuery({
        queryKey: invoiceKeys.list({ limit: 50 }),
        queryFn: () => api.get("/invoices", { limit: 50 }),
        ...prefetchConfig,
      });
    },

    prefetchBills: () => {
      void queryClient.prefetchQuery({
        queryKey: billKeys.list({ limit: 50 }),
        queryFn: () => api.get("/bills", { limit: 50 }),
        ...prefetchConfig,
      });
    },

    prefetchQuotations: () => {
      void queryClient.prefetchQuery({
        queryKey: quotationKeys.list({ limit: 50 }),
        queryFn: () => api.get("/quotations", { limit: 50 }),
        ...prefetchConfig,
      });
    },
  };
}
