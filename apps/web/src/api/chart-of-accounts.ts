/**
 * Chart of Accounts API hooks
 * React Query hooks for chart of accounts CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { AccountType, NormalBalance, SstTaxCode } from "@/zod-schemas/chart-of-accounts";

// Query keys
export const chartOfAccountsKeys = {
  all: ["chartOfAccounts"] as const,
  hasAccounts: () => [...chartOfAccountsKeys.all, "hasAccounts"] as const,
  tree: (accountType?: AccountType) => [...chartOfAccountsKeys.all, "tree", accountType] as const,
  summary: () => [...chartOfAccountsKeys.all, "summary"] as const,
  search: (query: string, excludeHeaders?: boolean) =>
    [...chartOfAccountsKeys.all, "search", query, excludeHeaders] as const,
  account: (id: string) => [...chartOfAccountsKeys.all, "account", id] as const,
  accountBalance: (accountId: string, asOfDate?: string) =>
    [...chartOfAccountsKeys.all, "accountBalance", accountId, asOfDate] as const,
  trialBalance: (asOfDate?: string) => [...chartOfAccountsKeys.all, "trialBalance", asOfDate] as const,
  journalEntries: (filters?: JournalEntryFilters) => [...chartOfAccountsKeys.all, "journalEntries", filters] as const,
  journalEntry: (id: string) => [...chartOfAccountsKeys.all, "journalEntry", id] as const,
};

// Types
export interface Account {
  id: string;
  userId: string;
  code: string;
  name: string;
  description?: string | null;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentId?: string | null;
  sstTaxCode?: SstTaxCode | null;
  isHeader: boolean;
  isSystemAccount: boolean;
  isActive: boolean;
  openingBalance?: string | null;
  currentBalance?: string | null;
  level: number;
  path: string | null;
  balance: string;
  createdAt: string;
  updatedAt: string;
  children: Account[];
}

export interface AccountSummary {
  assets: { total: number; count: number };
  liabilities: { total: number; count: number };
  equity: { total: number; count: number };
  revenue: { total: number; count: number };
  expenses: { total: number; count: number };
}

export interface CreateAccountInput {
  code: string;
  name: string;
  description?: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentId?: string | null;
  sstTaxCode?: SstTaxCode;
  isHeader?: boolean;
  openingBalance?: string;
}

export interface UpdateAccountInput extends CreateAccountInput {
  id: string;
}

export interface JournalEntryLine {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  description: string;
  reference?: string;
  lines: JournalEntryLine[];
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  reference?: string | null;
  status: "draft" | "posted" | "reversed";
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: string;
  postedAt?: string | null;
  reversedAt?: string | null;
  lines?: JournalEntryLineWithAccount[];
}

export interface JournalEntryLineWithAccount {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description?: string | null;
  account?: {
    code: string;
    name: string;
  };
}

export interface JournalEntryFilters {
  status?: "draft" | "posted" | "reversed";
  startDate?: string;
  endDate?: string;
  sourceType?: string;
  limit?: number;
  offset?: number;
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  balance: string;
  debitTotal: string;
  creditTotal: string;
}

export interface TrialBalanceEntry {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  debitBalance: string;
  creditBalance: string;
}

export interface TrialBalanceReport {
  entries: TrialBalanceEntry[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
  asOfDate: string;
}

// Cache config for chart of accounts queries
const coaCacheConfig = {
  staleTime: 10 * 60 * 1000,       // 10 minutes - accounts rarely change
  gcTime: 15 * 60 * 1000,          // 15 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks

export function useCheckHasAccounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.hasAccounts(),
    queryFn: () => api.get<{ hasAccounts: boolean }>("/chart-of-accounts/has-accounts"),
    enabled: options?.enabled,
    ...coaCacheConfig,
  });
}

export function useAccountTree(accountType?: AccountType, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.tree(accountType),
    queryFn: () =>
      api.get<Account[]>("/chart-of-accounts/tree", {
        ...(accountType && { accountType }),
      }),
    enabled: options?.enabled,
    ...coaCacheConfig,
  });
}

export function useAccountSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.summary(),
    queryFn: () => api.get<AccountSummary>("/chart-of-accounts/summary"),
    enabled: options?.enabled,
    ...coaCacheConfig,
  });
}

export function useSearchAccounts(
  query: string,
  excludeHeaders?: boolean,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: chartOfAccountsKeys.search(query, excludeHeaders),
    queryFn: () =>
      api.get<Account[]>("/chart-of-accounts/search", {
        query,
        ...(excludeHeaders !== undefined && { excludeHeaders: String(excludeHeaders) }),
      }),
    enabled: options?.enabled,
    staleTime: 30 * 1000,           // 30 seconds for search
    refetchOnMount: false,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      api.post<Account>("/chart-of-accounts/accounts", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.hasAccounts() });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateAccountInput) =>
      api.patch<Account>(`/chart-of-accounts/accounts/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
    },
  });
}

export function useInitializeDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<{ accountsCreated: number }>("/chart-of-accounts/initialize-defaults"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.hasAccounts() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
    },
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateJournalEntryInput) =>
      api.post<JournalEntry>("/chart-of-accounts/journal-entries", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.journalEntries() });
    },
  });
}

export function usePostJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post<JournalEntry>(`/chart-of-accounts/journal-entries/${id}/post`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.journalEntries() });
    },
  });
}

// ============= Missing Hooks Added =============

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/chart-of-accounts/accounts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.hasAccounts() });
    },
  });
}

export function useAccount(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.account(id),
    queryFn: () => api.get<Account & { balance: string }>(`/chart-of-accounts/accounts/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...coaCacheConfig,
  });
}

export function useAccountBalance(
  accountId: string,
  asOfDate?: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: chartOfAccountsKeys.accountBalance(accountId, asOfDate),
    queryFn: () =>
      api.get<AccountBalance>(`/chart-of-accounts/accounts/${accountId}/balance`, {
        ...(asOfDate && { asOfDate }),
      }),
    enabled: options?.enabled !== undefined ? options.enabled && !!accountId : !!accountId,
    ...coaCacheConfig,
  });
}

export function useTrialBalance(asOfDate?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.trialBalance(asOfDate),
    queryFn: () =>
      api.get<TrialBalanceReport>("/chart-of-accounts/trial-balance", {
        ...(asOfDate && { asOfDate }),
      }),
    enabled: options?.enabled,
    ...coaCacheConfig,
  });
}

export function useJournalEntries(filters?: JournalEntryFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.journalEntries(filters),
    queryFn: () =>
      api.get<JournalEntry[]>("/chart-of-accounts/journal-entries", {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.startDate && { startDate: filters.startDate }),
        ...(filters?.endDate && { endDate: filters.endDate }),
        ...(filters?.sourceType && { sourceType: filters.sourceType }),
        ...(filters?.limit && { limit: filters.limit }),
        ...(filters?.offset && { offset: filters.offset }),
      }),
    enabled: options?.enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes for journal entries
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useJournalEntry(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: chartOfAccountsKeys.journalEntry(id),
    queryFn: () => api.get<JournalEntry>(`/chart-of-accounts/journal-entries/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...coaCacheConfig,
  });
}

export function useReverseJournalEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reversalDate }: { id: string; reversalDate: string }) =>
      api.post<JournalEntry>(`/chart-of-accounts/journal-entries/${id}/reverse`, { reversalDate }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.tree() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.journalEntries() });
      void queryClient.invalidateQueries({ queryKey: chartOfAccountsKeys.trialBalance() });
    },
  });
}
