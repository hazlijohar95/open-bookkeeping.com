/**
 * Ledger API hooks
 * React Query hooks for financial reports and ledger operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const ledgerKeys = {
  all: ["ledger"] as const,
  trialBalance: (asOfDate?: string) => [...ledgerKeys.all, "trial-balance", asOfDate] as const,
  profitLoss: (startDate: string, endDate: string) => [...ledgerKeys.all, "profit-loss", startDate, endDate] as const,
  balanceSheet: (asOfDate?: string) => [...ledgerKeys.all, "balance-sheet", asOfDate] as const,
  periods: (year?: number) => [...ledgerKeys.all, "periods", year] as const,
  transactions: (query: string, filters?: TransactionSearchFilters) =>
    [...ledgerKeys.all, "transactions", query, filters] as const,
};

// Types
export interface TrialBalanceEntry {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
  debitBalance: string;
  creditBalance: string;
}

export interface TrialBalanceReport {
  asOfDate: string;
  entries: TrialBalanceEntry[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  balance: string;
}

export interface ProfitLossReport {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    accounts: AccountBalance[];
    total: string;
  };
  expenses: {
    costOfGoodsSold: AccountBalance[];
    operatingExpenses: AccountBalance[];
    otherExpenses: AccountBalance[];
    totalCOGS: string;
    totalOperating: string;
    totalOther: string;
    total: string;
  };
  grossProfit: string;
  operatingProfit: string;
  netProfit: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: {
    currentAssets: AccountBalance[];
    fixedAssets: AccountBalance[];
    totalCurrent: string;
    totalFixed: string;
    total: string;
  };
  liabilities: {
    currentLiabilities: AccountBalance[];
    nonCurrentLiabilities: AccountBalance[];
    totalCurrent: string;
    totalNonCurrent: string;
    total: string;
  };
  equity: {
    accounts: AccountBalance[];
    retainedEarnings: string;
    currentYearEarnings: string;
    total: string;
  };
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
}

export interface AccountingPeriod {
  id: string;
  year: number;
  month: number;
  status: "open" | "closed" | "locked";
  closedAt: string | null;
  closedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  notes: string | null;
}

export interface LedgerTransaction {
  id: string;
  transactionDate: string;
  entryNumber: string;
  description: string | null;
  reference: string | null;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
  accountCode: string;
  accountName: string;
}

export interface TransactionSearchFilters {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

// Cache config
const reportCacheConfig = {
  staleTime: 5 * 60 * 1000,       // 5 minutes
  gcTime: 10 * 60 * 1000,          // 10 minutes
  refetchOnMount: false,
  refetchOnWindowFocus: false,
};

// Hooks

/**
 * Get Trial Balance report
 */
export function useTrialBalanceReport(asOfDate?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ledgerKeys.trialBalance(asOfDate),
    queryFn: () =>
      api.get<TrialBalanceReport>("/ledger/trial-balance", {
        ...(asOfDate && { asOfDate }),
      }),
    enabled: options?.enabled,
    ...reportCacheConfig,
  });
}

/**
 * Get Profit & Loss report
 */
export function useProfitLossReport(
  startDate: string,
  endDate: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ledgerKeys.profitLoss(startDate, endDate),
    queryFn: () =>
      api.get<ProfitLossReport>("/ledger/profit-loss", {
        startDate,
        endDate,
      }),
    enabled: options?.enabled !== undefined ? options.enabled && !!startDate && !!endDate : !!startDate && !!endDate,
    ...reportCacheConfig,
  });
}

/**
 * Get Balance Sheet report
 */
export function useBalanceSheetReport(asOfDate?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ledgerKeys.balanceSheet(asOfDate),
    queryFn: () =>
      api.get<BalanceSheetReport>("/ledger/balance-sheet", {
        ...(asOfDate && { asOfDate }),
      }),
    enabled: options?.enabled,
    ...reportCacheConfig,
  });
}

/**
 * Get accounting periods
 */
export function useAccountingPeriods(year?: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ledgerKeys.periods(year),
    queryFn: () =>
      api.get<{ periods: AccountingPeriod[] }>("/ledger/periods", {
        ...(year && { year }),
      }),
    enabled: options?.enabled,
    ...reportCacheConfig,
  });
}

/**
 * Close accounting period
 */
export function useClosePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month, notes }: { year: number; month: number; notes?: string }) =>
      api.post<{ success: boolean; periodId: string }>("/ledger/periods/close", {
        year,
        month,
        notes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ledgerKeys.periods() });
    },
  });
}

/**
 * Reopen accounting period
 */
export function useReopenPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ year, month, reason }: { year: number; month: number; reason: string }) =>
      api.post<{ success: boolean; periodId: string }>("/ledger/periods/reopen", {
        year,
        month,
        reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ledgerKeys.periods() });
    },
  });
}

/**
 * SearchIcon ledger transactions
 */
export function useSearchTransactions(
  query: string,
  filters?: TransactionSearchFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ledgerKeys.transactions(query, filters),
    queryFn: () =>
      api.get<{ transactions: LedgerTransaction[] }>("/ledger/transactions/search", {
        query,
        ...(filters?.startDate && { startDate: filters.startDate }),
        ...(filters?.endDate && { endDate: filters.endDate }),
        ...(filters?.limit && { limit: filters.limit }),
      }),
    enabled: options?.enabled !== undefined ? options.enabled && query.length > 0 : query.length > 0,
    staleTime: 30 * 1000, // 30 seconds for search
    refetchOnMount: false,
  });
}
