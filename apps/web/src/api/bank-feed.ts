/**
 * Bank Feed API hooks
 * React Query hooks for bank account management and transaction reconciliation
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginationParams } from "@/lib/api-client";

// Query keys
export const bankFeedKeys = {
  all: ["bankFeed"] as const,
  accounts: () => [...bankFeedKeys.all, "accounts"] as const,
  account: (id: string) => [...bankFeedKeys.all, "account", id] as const,
  transactions: (accountId: string, params?: TransactionParams) =>
    [...bankFeedKeys.all, "transactions", accountId, params] as const,
  transaction: (id: string) => [...bankFeedKeys.all, "transaction", id] as const,
  unmatched: (accountId?: string) => [...bankFeedKeys.all, "unmatched", accountId] as const,
  categories: () => [...bankFeedKeys.all, "categories"] as const,
  rules: () => [...bankFeedKeys.all, "rules"] as const,
  stats: (accountId?: string) => [...bankFeedKeys.all, "stats", accountId] as const,
  suggestions: (transactionId: string) => [...bankFeedKeys.all, "suggestions", transactionId] as const,
};

// Types
export interface BankAccount {
  id: string;
  userId: string;
  accountName: string;
  bankName?: string;
  accountNumber?: string;
  currency: string;
  openingBalance?: string;
  openingBalanceDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountInput {
  accountName: string;
  bankName?: string;
  accountNumber?: string;
  currency?: string;
  openingBalance?: string;
  openingBalanceDate?: string;
}

export interface UpdateBankAccountInput extends Partial<CreateBankAccountInput> {
  id: string;
  isActive?: boolean;
}

export interface TransactionParams extends PaginationParams {
  matchStatus?: "unmatched" | "suggested" | "matched" | "excluded";
  startDate?: string;
  endDate?: string;
  type?: "deposit" | "withdrawal";
}

export interface BankTransaction {
  id: string;
  userId: string;
  bankAccountId: string;
  uploadId?: string;
  transactionDate: string;
  description: string;
  reference?: string;
  amount: string;
  type: "deposit" | "withdrawal";
  balance?: string;
  matchStatus: "unmatched" | "suggested" | "matched" | "excluded";
  matchedInvoiceId?: string;
  matchedBillId?: string;
  matchedCustomerId?: string;
  matchedVendorId?: string;
  categoryId?: string;
  matchConfidence?: string;
  notes?: string;
  isReconciled: boolean;
  reconciledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  bankAccountId: string;
  transactionDate: string;
  description: string;
  reference?: string;
  amount: string;
  type: "deposit" | "withdrawal";
  balance?: string;
}

export interface ImportTransactionsInput {
  bankAccountId: string;
  fileName: string;
  bankPreset?: "maybank" | "cimb" | "public_bank" | "rhb" | "hong_leong" | "custom";
  transactions: Array<{
    transactionDate: string;
    description: string;
    reference?: string;
    amount: string;
    type: "deposit" | "withdrawal";
    balance?: string;
  }>;
}

export interface ImportResult {
  upload: {
    id: string;
    fileName: string;
    transactionCount: number;
  };
  transactionCount: number;
}

export interface UpdateMatchInput {
  id: string;
  matchStatus: "unmatched" | "suggested" | "matched" | "excluded";
  matchedInvoiceId?: string | null;
  matchedBillId?: string | null;
  matchedCustomerId?: string | null;
  matchedVendorId?: string | null;
  categoryId?: string | null;
  matchConfidence?: string | null;
  notes?: string | null;
}

export interface BankFeedCategory {
  id: string;
  userId: string;
  name: string;
  type: "income" | "expense";
  color?: string;
  createdAt: string;
}

export interface CreateCategoryInput {
  name: string;
  type: "income" | "expense";
  color?: string;
}

export interface MatchingRule {
  id: string;
  userId: string;
  name: string;
  priority: number;
  conditions: {
    descriptionContains?: string[];
    descriptionPattern?: string;
    amountMin?: number;
    amountMax?: number;
    amountExact?: number;
    transactionType?: "deposit" | "withdrawal";
  };
  action: {
    type: "match_customer" | "match_vendor" | "categorize";
    customerId?: string;
    vendorId?: string;
    categoryId?: string;
  };
  createdAt: string;
}

export interface CreateRuleInput {
  name: string;
  priority?: number;
  conditions: MatchingRule["conditions"];
  action: MatchingRule["action"];
}

export interface BankFeedStats {
  total: number;
  unmatched: number;
  suggested: number;
  matched: number;
  excluded: number;
  reconciled: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
}

export interface MatchSuggestion {
  type: "customer" | "vendor" | "invoice" | "bill";
  id: string;
  name: string;
  confidence: number;
  reason: string;
  matchedAmount?: string;
}

export interface ApplyMatchInput {
  transactionId: string;
  matchType: "customer" | "vendor" | "invoice" | "bill" | "category";
  matchId: string;
  confidence?: number;
}

export interface AutoMatchResult {
  matchedCount: number;
  suggestedCount: number;
  totalProcessed: number;
}

export interface ReconcileMatchedResult {
  reconciledCount: number;
}

// Account Hooks
export function useBankAccounts() {
  return useQuery({
    queryKey: bankFeedKeys.accounts(),
    queryFn: () => api.get<BankAccount[]>("/bank-feed/accounts"),
  });
}

export function useBankAccount(id: string) {
  return useQuery({
    queryKey: bankFeedKeys.account(id),
    queryFn: () => api.get<BankAccount>(`/bank-feed/accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBankAccountInput) =>
      api.post<BankAccount>("/bank-feed/accounts", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.accounts() });
    },
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateBankAccountInput) =>
      api.patch<BankAccount>(`/bank-feed/accounts/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.accounts() });
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.account(variables.id) });
    },
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/bank-feed/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.accounts() });
    },
  });
}

// Transaction Hooks
export function useTransactions(accountId: string, params?: TransactionParams) {
  return useQuery({
    queryKey: bankFeedKeys.transactions(accountId, params),
    queryFn: () =>
      api.get<{ data: BankTransaction[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>(
        `/bank-feed/accounts/${accountId}/transactions`,
        {
          limit: params?.limit,
          offset: params?.offset,
          matchStatus: params?.matchStatus,
          startDate: params?.startDate,
          endDate: params?.endDate,
          type: params?.type,
        }
      ),
    enabled: !!accountId,
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: bankFeedKeys.transaction(id),
    queryFn: () => api.get<BankTransaction>(`/bank-feed/transactions/${id}`),
    enabled: !!id,
  });
}

export function useUnmatchedTransactions(accountId?: string) {
  return useQuery({
    queryKey: bankFeedKeys.unmatched(accountId),
    queryFn: () =>
      api.get<BankTransaction[]>("/bank-feed/transactions/unmatched", { bankAccountId: accountId }),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      api.post<BankTransaction>("/bank-feed/transactions", input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.transactions(variables.bankAccountId) });
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.stats() });
    },
  });
}

export function useImportTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportTransactionsInput) =>
      api.post<ImportResult>("/bank-feed/transactions/import", input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.transactions(variables.bankAccountId) });
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.stats() });
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.unmatched() });
    },
  });
}

export function useUpdateTransactionMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMatchInput) =>
      api.patch<BankTransaction>(`/bank-feed/transactions/${id}/match`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}

export function useReconcileTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<BankTransaction>(`/bank-feed/transactions/${id}/reconcile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<BankTransaction>(`/bank-feed/transactions/${id}/accept-suggestion`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}

export function useRejectSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<BankTransaction>(`/bank-feed/transactions/${id}/reject-suggestion`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}

// Category Hooks
export function useBankFeedCategories() {
  return useQuery({
    queryKey: bankFeedKeys.categories(),
    queryFn: () => api.get<BankFeedCategory[]>("/bank-feed/categories"),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      api.post<BankFeedCategory>("/bank-feed/categories", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.categories() });
    },
  });
}

// Rule Hooks
export function useMatchingRules() {
  return useQuery({
    queryKey: bankFeedKeys.rules(),
    queryFn: () => api.get<MatchingRule[]>("/bank-feed/rules"),
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRuleInput) =>
      api.post<MatchingRule>("/bank-feed/rules", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.rules() });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/bank-feed/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.rules() });
    },
  });
}

// Stats & Matching Hooks
export function useBankFeedStats(accountId?: string) {
  return useQuery({
    queryKey: bankFeedKeys.stats(accountId),
    queryFn: () => api.get<BankFeedStats>("/bank-feed/stats", { bankAccountId: accountId }),
  });
}

export function useMatchSuggestions(transactionId: string) {
  return useQuery({
    queryKey: bankFeedKeys.suggestions(transactionId),
    queryFn: () => api.get<MatchSuggestion[]>(`/bank-feed/transactions/${transactionId}/suggestions`),
    enabled: !!transactionId,
  });
}

export function useApplyMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplyMatchInput) =>
      api.post<BankTransaction>("/bank-feed/transactions/apply-match", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}

export function useAutoMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: { bankAccountId?: string }) =>
      api.post<AutoMatchResult>("/bank-feed/auto-match", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}

export function useReconcileMatched() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: { bankAccountId?: string }) =>
      api.post<ReconcileMatchedResult>("/bank-feed/reconcile-matched", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankFeedKeys.all });
    },
  });
}
