/**
 * Bill API hooks
 * React Query hooks for bill (accounts payable) CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse, type PaginationParams } from "@/lib/api-client";

// Query keys
export const billKeys = {
  all: ["bills"] as const,
  lists: () => [...billKeys.all, "list"] as const,
  list: (params?: BillListParams) => [...billKeys.lists(), params] as const,
  details: () => [...billKeys.all, "detail"] as const,
  detail: (id: string) => [...billKeys.details(), id] as const,
  byVendor: (vendorId: string) => [...billKeys.all, "byVendor", vendorId] as const,
  unpaid: () => [...billKeys.all, "unpaid"] as const,
  agingReport: () => [...billKeys.all, "agingReport"] as const,
};

// Types
export interface BillListParams extends PaginationParams {
  vendorId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface Bill {
  id: string;
  userId: string;
  vendorId: string | null;
  billNumber: string;
  description: string | null;
  currency: string;
  billDate: Date;
  dueDate: Date | null;
  status: "draft" | "pending" | "paid" | "overdue" | "cancelled";
  notes: string | null;
  attachmentUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: BillItem[];
  vendor: {
    id: string;
    name: string;
    email: string | null;
  } | null;
}

export interface BillItem {
  id: string;
  billId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface BillItemInput {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface CreateBillInput {
  vendorId?: string | null;
  billNumber: string;
  description?: string;
  currency?: string;
  billDate: string;
  dueDate?: string | null;
  status?: string;
  notes?: string;
  attachmentUrl?: string;
  items: BillItemInput[];
}

export interface UpdateBillInput extends Partial<Omit<CreateBillInput, "items">> {
  id: string;
  items?: BillItemInput[];
}

export interface UpdateBillStatusInput {
  id: string;
  status: string;
  paidAt?: string;
}

export interface BillAgingReport {
  current: Bill[];
  "1-30": Bill[];
  "31-60": Bill[];
  "61-90": Bill[];
  "90+": Bill[];
}

// Cache config for bill queries
const billCacheConfig = {
  staleTime: 3 * 60 * 1000,        // 3 minutes - bills may change more often
  gcTime: 10 * 60 * 1000,          // 10 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useBills(options?: BillListParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: billKeys.list(options),
    queryFn: () =>
      api.get<Bill[]>("/bills", {
        limit: options?.limit,
        offset: options?.offset,
        vendorId: options?.vendorId,
        status: options?.status,
        startDate: options?.startDate,
        endDate: options?.endDate,
      }),
    enabled: options?.enabled,
    ...billCacheConfig,
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: billKeys.detail(id),
    queryFn: () => api.get<Bill>(`/bills/${id}`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,       // Individual bill can be cached longer
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useBillsByVendor(vendorId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: billKeys.byVendor(vendorId),
    queryFn: () =>
      api.get<PaginatedResponse<Bill>>(`/bills/by-vendor/${vendorId}`, {
        limit: params?.limit,
        offset: params?.offset,
      }),
    enabled: !!vendorId,
    ...billCacheConfig,
  });
}

export function useUnpaidBills(vendorId?: string) {
  return useQuery({
    queryKey: billKeys.unpaid(),
    queryFn: () => api.get<Bill[]>("/bills/unpaid", { vendorId }),
    ...billCacheConfig,
  });
}

export function useBillAgingReport(vendorId?: string) {
  return useQuery({
    queryKey: billKeys.agingReport(),
    queryFn: () => api.get<BillAgingReport>("/bills/aging-report", { vendorId }),
    staleTime: 5 * 60 * 1000,       // Aging report changes slowly
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBillInput) => api.post<Bill>("/bills", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.lists() });
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateBillInput) =>
      api.patch<Bill>(`/bills/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billKeys.lists() });
      queryClient.invalidateQueries({ queryKey: billKeys.detail(variables.id) });
    },
  });
}

export function useUpdateBillStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateBillStatusInput) =>
      api.patch<Bill>(`/bills/${id}/status`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: billKeys.lists() });
      queryClient.invalidateQueries({ queryKey: billKeys.detail(variables.id) });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.lists() });
    },
  });
}
