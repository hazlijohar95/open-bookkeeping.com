/**
 * Statements API hooks
 * React Query hooks for statement of accounts operations
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const statementKeys = {
  all: ["statements"] as const,
  customers: (limit?: number, offset?: number) => [...statementKeys.all, "customers", limit, offset] as const,
  vendors: (limit?: number, offset?: number) => [...statementKeys.all, "vendors", limit, offset] as const,
  customerStatement: (customerId: string, startDate?: Date, endDate?: Date) =>
    [...statementKeys.all, "customerStatement", customerId, startDate?.toISOString(), endDate?.toISOString()] as const,
  vendorStatement: (vendorId: string, startDate?: Date, endDate?: Date) =>
    [...statementKeys.all, "vendorStatement", vendorId, startDate?.toISOString(), endDate?.toISOString()] as const,
  allCustomersSummary: (limit?: number, offset?: number) => [...statementKeys.all, "allCustomersSummary", limit, offset] as const,
};

// Types
export interface StatementCustomer {
  id: string;
  name: string;
  email?: string | null;
}

export interface StatementVendor {
  id: string;
  name: string;
  email?: string | null;
}

export interface StatementEntry {
  id: string;
  date: string;
  type: "invoice" | "payment" | "credit_note" | "debit_note" | "bill";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementSummary {
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    email?: string | null;
    address?: string | null;
  };
  entries: StatementEntry[];
  summary: StatementSummary;
  currency: string;
}

export interface VendorStatement {
  vendor: {
    id: string;
    name: string;
    email?: string | null;
    address?: string | null;
  };
  entries: StatementEntry[];
  summary: StatementSummary;
  currency: string;
}

export interface CustomerSummary {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  totalInvoiced: number;
  outstanding: number;
}

// Paginated response type
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// Cache config for statement queries
const statementCacheConfig = {
  staleTime: 5 * 60 * 1000,        // 5 minutes - statements don't change often
  gcTime: 15 * 60 * 1000,          // 15 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks

export function useStatementCustomers(options?: {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { enabled, limit = 100, offset = 0 } = options ?? {};
  return useQuery({
    queryKey: statementKeys.customers(limit, offset),
    queryFn: () => api.get<PaginatedResponse<StatementCustomer>>("/statements/customers", { limit, offset }),
    enabled,
    ...statementCacheConfig,
  });
}

export function useStatementVendors(options?: {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { enabled, limit = 100, offset = 0 } = options ?? {};
  return useQuery({
    queryKey: statementKeys.vendors(limit, offset),
    queryFn: () => api.get<PaginatedResponse<StatementVendor>>("/statements/vendors", { limit, offset }),
    enabled,
    ...statementCacheConfig,
  });
}

export function useCustomerStatement(
  customerId: string,
  startDate?: Date,
  endDate?: Date,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: statementKeys.customerStatement(customerId, startDate, endDate),
    queryFn: () =>
      api.get<CustomerStatement>(`/statements/customer/${customerId}`, {
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() }),
      }),
    enabled: options?.enabled !== undefined ? options.enabled && !!customerId : !!customerId,
    ...statementCacheConfig,
  });
}

export function useVendorStatement(
  vendorId: string,
  startDate?: Date,
  endDate?: Date,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: statementKeys.vendorStatement(vendorId, startDate, endDate),
    queryFn: () =>
      api.get<VendorStatement>(`/statements/vendor/${vendorId}`, {
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() }),
      }),
    enabled: options?.enabled !== undefined ? options.enabled && !!vendorId : !!vendorId,
    ...statementCacheConfig,
  });
}

export function useAllCustomersSummary(options?: {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { enabled, limit = 50, offset = 0 } = options ?? {};
  return useQuery({
    queryKey: statementKeys.allCustomersSummary(limit, offset),
    queryFn: () => api.get<PaginatedResponse<CustomerSummary>>("/statements/customers/summary", { limit, offset }),
    enabled,
    ...statementCacheConfig,
  });
}
