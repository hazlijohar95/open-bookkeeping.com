/**
 * Customer API hooks
 * React Query hooks for customer CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginationParams } from "@/lib/api-client";
import type { Customer } from "@/types/common/customer";

// Query keys
export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  list: (params?: PaginationParams) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, "detail"] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
  search: (query: string) => [...customerKeys.all, "search", query] as const,
};

// Types
export interface CreateCustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {
  id: string;
}

// Cache config for customer queries - customers don't change often
const customerCacheConfig = {
  staleTime: 10 * 60 * 1000,       // 10 minutes - customers rarely change
  gcTime: 15 * 60 * 1000,          // 15 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useCustomers(options?: { enabled?: boolean } & PaginationParams) {
  return useQuery({
    queryKey: customerKeys.list(options),
    queryFn: () =>
      api.get<Customer[]>("/customers", {
        limit: options?.limit,
        offset: options?.offset,
      }),
    enabled: options?.enabled,
    ...customerCacheConfig,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: !!id,
    ...customerCacheConfig,
  });
}

export function useSearchCustomers(query: string) {
  return useQuery({
    queryKey: customerKeys.search(query),
    queryFn: () => api.get<Customer[]>("/customers/search", { q: query }),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,           // 30 seconds for search - may need fresher results
    refetchOnMount: false,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCustomerInput) =>
      api.post<Customer>("/customers", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCustomerInput) =>
      api.patch<Customer>(`/customers/${id}`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/customers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
