/**
 * Dashboard API hooks
 * React Query hooks for dashboard analytics and statistics
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
  invoiceStatus: () => [...dashboardKeys.all, "invoiceStatus"] as const,
  revenueChart: (period?: string) => [...dashboardKeys.all, "revenueChart", period] as const,
  topCustomers: (limit?: number) => [...dashboardKeys.all, "topCustomers", limit] as const,
  recentInvoices: (limit?: number) => [...dashboardKeys.all, "recentInvoices", limit] as const,
};

// Types
export interface DashboardStats {
  totalInvoices: number;
  totalRevenue: number;
  revenueThisMonth: number;
  pendingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  paidThisMonth: number;
  invoicesThisMonth: number;
  totalQuotations: number;
  conversionRate: number;
  convertedQuotations: number;
  currency: string;
}

// Status breakdown for pie chart (matches component interface)
export interface StatusBreakdown {
  pending: number;
  paid: number;
  overdue: number;
  expired: number;
  refunded: number;
}

export interface RevenueChartData {
  date: string;
  revenue: number;
}

export interface TopCustomer {
  name: string;
  email: string | null;
  revenue: number;
  invoiceCount: number;
}

export interface RecentInvoice {
  id: string;
  serialNumber: string;
  customerName: string;
  total: number;
  currency: string;
  status: string;
  date: Date;
  dueDate?: Date | null;
}

// Shared cache config for dashboard queries - these are expensive, cache aggressively
const dashboardCacheConfig = {
  staleTime: 5 * 60 * 1000,       // 5 minutes - dashboard data doesn't change that fast
  gcTime: 15 * 60 * 1000,         // 15 minutes cache retention
  refetchOnMount: false,           // Use cache on navigation - critical for speed
  refetchOnWindowFocus: false,     // Don't refetch on tab switch
};

// Hooks
export function useDashboardStats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
    enabled: options?.enabled,
    ...dashboardCacheConfig,
  });
}

export function useInvoiceStatusDistribution(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.invoiceStatus(),
    queryFn: () => api.get<StatusBreakdown>("/dashboard/invoice-status"),
    enabled: options?.enabled,
    ...dashboardCacheConfig,
  });
}

export function useRevenueChart(period: "7d" | "30d" | "90d" | "12m" = "30d", options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.revenueChart(period),
    queryFn: () => api.get<RevenueChartData[]>("/dashboard/revenue-chart", { period }),
    enabled: options?.enabled,
    ...dashboardCacheConfig,
  });
}

export function useTopCustomers(limit = 5, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.topCustomers(limit),
    queryFn: () => api.get<TopCustomer[]>("/dashboard/top-customers", { limit }),
    enabled: options?.enabled,
    ...dashboardCacheConfig,
  });
}

export function useRecentInvoices(limit = 5, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dashboardKeys.recentInvoices(limit),
    queryFn: () => api.get<RecentInvoice[]>("/dashboard/recent-invoices", { limit }),
    enabled: options?.enabled,
    ...dashboardCacheConfig,
  });
}

export function useRebuildAggregations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/dashboard/rebuild-aggregations"),
    onSuccess: () => {
      // Invalidate all dashboard queries
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
