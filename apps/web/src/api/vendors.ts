/**
 * Vendor API hooks
 * React Query hooks for vendor CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginationParams } from "@/lib/api-client";
import type { Vendor } from "@/types/common/vendor";

// Query keys
export const vendorKeys = {
  all: ["vendors"] as const,
  lists: () => [...vendorKeys.all, "list"] as const,
  list: (params?: PaginationParams) => [...vendorKeys.lists(), params] as const,
  details: () => [...vendorKeys.all, "detail"] as const,
  detail: (id: string) => [...vendorKeys.details(), id] as const,
  search: (query: string) => [...vendorKeys.all, "search", query] as const,
};

// Types
export interface CreateVendorInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {
  id: string;
}

// Cache config for vendor queries - vendors don't change often
const vendorCacheConfig = {
  staleTime: 10 * 60 * 1000,       // 10 minutes - vendors rarely change
  gcTime: 15 * 60 * 1000,          // 15 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useVendors(options?: { enabled?: boolean } & PaginationParams) {
  return useQuery({
    queryKey: vendorKeys.list(options),
    queryFn: () =>
      api.get<Vendor[]>("/vendors", {
        limit: options?.limit,
        offset: options?.offset,
      }),
    enabled: options?.enabled,
    ...vendorCacheConfig,
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: () => api.get<Vendor>(`/vendors/${id}`),
    enabled: !!id,
    ...vendorCacheConfig,
  });
}

export function useSearchVendors(query: string) {
  return useQuery({
    queryKey: vendorKeys.search(query),
    queryFn: () => api.get<Vendor[]>("/vendors/search", { q: query }),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,           // 30 seconds for search - may need fresher results
    refetchOnMount: false,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVendorInput) =>
      api.post<Vendor>("/vendors", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateVendorInput) =>
      api.patch<Vendor>(`/vendors/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(variables.id) });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() });
    },
  });
}
