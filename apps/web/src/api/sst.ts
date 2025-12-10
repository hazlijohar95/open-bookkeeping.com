/**
 * SST (Sales & Service Tax) API hooks
 * React Query hooks for Malaysian SST compliance
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const sstKeys = {
  all: ["sst"] as const,
  ratePresets: () => [...sstKeys.all, "ratePresets"] as const,
  businessCategories: () => [...sstKeys.all, "businessCategories"] as const,
  summary: (params?: SummaryParams) => [...sstKeys.all, "summary", params] as const,
  trendChart: (period?: string) => [...sstKeys.all, "trendChart", period] as const,
  transactions: (params?: TransactionParams) => [...sstKeys.all, "transactions", params] as const,
  sst02Return: (taxPeriod: string) => [...sstKeys.all, "sst02Return", taxPeriod] as const,
  availablePeriods: () => [...sstKeys.all, "availablePeriods"] as const,
  returnSubmissions: () => [...sstKeys.all, "returnSubmissions"] as const,
  complianceStatus: () => [...sstKeys.all, "complianceStatus"] as const,
};

// Types
export interface SSTRatePreset {
  code: string;
  label: string;
  rate: number;
  taxType: "sales_tax" | "service_tax";
}

export interface BusinessCategory {
  value: string;
  label: string;
  threshold: number;
}

export interface SummaryParams {
  period?: "current_month" | "last_month" | "quarter" | "year" | "custom";
  startDate?: string;
  endDate?: string;
}

export interface SSTSummary {
  totalSalesTax: number;
  totalServiceTax: number;
  totalOutputTax: number;
  totalTaxableAmount: number;
  transactionCount: number;
  periodStart: string;
  periodEnd: string;
  comparison: {
    previousTotal: number;
    percentChange: number;
    trend: "up" | "down" | "flat";
  };
}

export interface TrendChartData {
  month: string;
  salesTax: number;
  serviceTax: number;
  total: number;
}

export interface TransactionParams {
  page?: number;
  pageSize?: number;
  taxType?: "all" | "sales_tax" | "service_tax";
  documentType?: "all" | "invoice" | "credit_note" | "debit_note";
  startDate?: string;
  endDate?: string;
}

export interface SSTTransaction {
  id: string;
  documentType: string;
  documentId: string;
  documentNumber: string;
  documentDate: string;
  customerName?: string;
  customerTin?: string;
  taxType: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  description?: string;
  taxPeriod?: string;
}

export interface TransactionsResponse {
  transactions: SSTTransaction[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface SST02Return {
  partA: {
    sstRegistrationNumber: string;
    tin: string;
    brn: string;
    taxPeriod: string;
    periodStart: string;
    periodEnd: string;
  };
  partB: {
    byRate: Array<{
      rate: number;
      taxableAmount: number;
      taxAmount: number;
      transactionCount: number;
    }>;
    totalTaxableAmount: number;
    totalTaxAmount: number;
  };
  partC: {
    byRate: Array<{
      rate: number;
      taxableAmount: number;
      taxAmount: number;
      transactionCount: number;
    }>;
    totalTaxableAmount: number;
    totalTaxAmount: number;
  };
  partD: {
    totalSalesTax: number;
    totalServiceTax: number;
    totalTaxPayable: number;
  };
  transactions: SSTTransaction[];
}

export interface ReturnSubmission {
  id: string;
  taxPeriodCode: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "submitted" | "amended";
  referenceNumber?: string;
  totalSalesTax: number;
  totalServiceTax: number;
  totalTaxPayable: number;
  transactionCount: number;
  submittedAt?: string;
  notes?: string;
}

export interface SaveReturnInput {
  taxPeriodCode: string;
  status: "draft" | "submitted" | "amended";
  referenceNumber?: string;
  notes?: string;
}

export interface ComplianceStatus {
  businessCategory: string;
  businessCategoryLabel: string;
  threshold: number;
  calculatedRevenue: number;
  manualRevenue: number;
  useManualRevenue: boolean;
  currentRevenue: number;
  progressPercent: number;
  status: "below" | "voluntary" | "approaching" | "exceeded" | "registered";
  isRegistered: boolean;
  registrationNumber?: string | null;
  registrationDate?: string | null;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
}

export interface ComplianceSettingsInput {
  businessCategory?: string;
  manualRevenue?: number;
  useManualRevenue?: boolean;
  registrationNumber?: string | null;
  registrationDate?: string | null;
}

// Cache config for SST queries
const sstCacheConfig = {
  staleTime: 5 * 60 * 1000,        // 5 minutes - tax data doesn't change often
  gcTime: 15 * 60 * 1000,          // 15 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useSSTRatePresets() {
  return useQuery({
    queryKey: sstKeys.ratePresets(),
    queryFn: () => api.get<SSTRatePreset[]>("/sst/rate-presets"),
    staleTime: Infinity, // Static data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useBusinessCategories(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.businessCategories(),
    queryFn: () => api.get<BusinessCategory[]>("/sst/business-categories"),
    staleTime: Infinity, // Static data
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: options?.enabled,
  });
}

export function useSSTSummary(params?: SummaryParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.summary(params),
    queryFn: () =>
      api.get<SSTSummary>("/sst/summary", {
        period: params?.period,
        startDate: params?.startDate,
        endDate: params?.endDate,
      }),
    enabled: options?.enabled,
    ...sstCacheConfig,
  });
}

export function useSSTTrendChart(period: "6m" | "12m" = "6m", options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.trendChart(period),
    queryFn: () => api.get<TrendChartData[]>("/sst/trend-chart", { period }),
    enabled: options?.enabled,
    ...sstCacheConfig,
  });
}

export function useSSTTransactions(params?: TransactionParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.transactions(params),
    queryFn: () =>
      api.get<TransactionsResponse>("/sst/transactions", {
        page: params?.page,
        pageSize: params?.pageSize,
        taxType: params?.taxType,
        documentType: params?.documentType,
        startDate: params?.startDate,
        endDate: params?.endDate,
      }),
    enabled: options?.enabled,
    ...sstCacheConfig,
  });
}

export function useSST02Return(taxPeriod: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.sst02Return(taxPeriod),
    queryFn: () => api.get<SST02Return>(`/sst/sst02-return/${taxPeriod}`),
    enabled: options?.enabled !== undefined ? options.enabled : !!taxPeriod,
    ...sstCacheConfig,
  });
}

export function useAvailablePeriods(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.availablePeriods(),
    queryFn: () => api.get<string[]>("/sst/available-periods"),
    enabled: options?.enabled,
    ...sstCacheConfig,
  });
}

export function useReturnSubmissions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.returnSubmissions(),
    queryFn: () => api.get<ReturnSubmission[]>("/sst/return-submissions"),
    enabled: options?.enabled,
    ...sstCacheConfig,
  });
}

export function useSaveReturnSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveReturnInput) =>
      api.post<{ id: string; action: string }>("/sst/return-submission", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sstKeys.returnSubmissions() });
    },
  });
}

export function useComplianceStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sstKeys.complianceStatus(),
    queryFn: () => api.get<ComplianceStatus>("/sst/compliance-status"),
    enabled: options?.enabled,
    ...sstCacheConfig,
  });
}

export function useUpdateComplianceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ComplianceSettingsInput) =>
      api.patch<{ success: boolean }>("/sst/compliance-settings", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sstKeys.complianceStatus() });
    },
  });
}
