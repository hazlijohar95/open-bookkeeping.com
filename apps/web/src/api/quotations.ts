/**
 * Quotation API hooks
 * React Query hooks for quotation CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse, type PaginationParams } from "@/lib/api-client";
import { invoiceKeys } from "./invoices";

// Query keys
export const quotationKeys = {
  all: ["quotations"] as const,
  lists: () => [...quotationKeys.all, "list"] as const,
  list: (params?: QuotationListParams) => [...quotationKeys.lists(), params] as const,
  details: () => [...quotationKeys.all, "detail"] as const,
  detail: (id: string) => [...quotationKeys.details(), id] as const,
  byCustomer: (customerId: string) => [...quotationKeys.all, "byCustomer", customerId] as const,
};

// Types
export interface QuotationListParams extends PaginationParams {
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface Quotation {
  id: string;
  userId: string;
  customerId?: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
  convertedInvoiceId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  quotationFields?: {
    companyDetails?: {
      name: string;
      address: string;
      logo?: string | null;
      signature?: string | null;
      metadata?: Array<{ label: string; value: string }>;
    };
    clientDetails?: {
      name: string;
      address: string;
      metadata?: Array<{ label: string; value: string }>;
    };
    quotationDetails?: {
      theme?: {
        baseColor?: string;
        mode?: string;
        template?: string;
      };
      currency: string;
      prefix: string;
      serialNumber: string;
      date: string;
      validUntil?: string;
      paymentTerms?: string;
      billingDetails?: Array<{ label: string; value: string | number }>;
    };
    items: Array<{
      name: string;
      description?: string;
      quantity: number;
      unitPrice: number;
    }>;
    metadata?: {
      notes?: string;
      terms?: string;
      paymentInformation?: Array<{ label: string; value: string }>;
    };
  } | null;
}

export interface CreateQuotationInput {
  customerId?: string | null;
  status?: string;
  quotationDetails?: {
    prefix?: string;
    serialNumber?: string;
    date?: Date | string;
    validUntil?: Date | string | null;
    currency?: string;
    paymentTerms?: string;
    theme?: {
      baseColor: string;
      mode: "dark" | "light";
      template?: "default" | "cynco" | "classic" | "zen" | "executive";
    };
    billingDetails?: Array<{
      label: string;
      value: number;
      type: "fixed" | "percentage";
      isSstTax?: boolean;
      sstTaxType?: "sales_tax" | "service_tax";
      sstRateCode?: string;
    }>;
  };
  companyDetails?: Record<string, unknown>;
  clientDetails?: Record<string, unknown>;
  items?: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;
  metadata?: {
    notes?: string;
    terms?: string;
    paymentInformation?: Array<{
      label: string;
      value: string;
    }>;
  };
}

export interface UpdateQuotationStatusInput {
  id: string;
  status: string;
}

export interface ConvertToInvoiceInput {
  quotationId: string;
  issueDate?: string;
  dueDate?: string;
}

// Cache config for quotation queries
const quotationCacheConfig = {
  staleTime: 5 * 60 * 1000,        // 5 minutes - quotations change moderately
  gcTime: 10 * 60 * 1000,          // 10 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useQuotations(options?: QuotationListParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: quotationKeys.list(options),
    queryFn: () =>
      api.get<Quotation[]>("/quotations", {
        limit: options?.limit,
        offset: options?.offset,
        customerId: options?.customerId,
        status: options?.status,
        startDate: options?.startDate,
        endDate: options?.endDate,
      }),
    enabled: options?.enabled,
    ...quotationCacheConfig,
  });
}

export function useQuotation(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: quotationKeys.detail(id),
    queryFn: () => api.get<Quotation>(`/quotations/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...quotationCacheConfig,
  });
}

export function useQuotationsByCustomer(customerId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: quotationKeys.byCustomer(customerId),
    queryFn: () =>
      api.get<PaginatedResponse<Quotation>>(`/quotations/by-customer/${customerId}`, {
        limit: params?.limit,
        offset: params?.offset,
      }),
    enabled: !!customerId,
    ...quotationCacheConfig,
  });
}

export function useCreateQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateQuotationInput) =>
      api.post<Quotation>("/quotations", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}

export function useUpdateQuotationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateQuotationStatusInput) =>
      api.patch<Quotation>(`/quotations/${id}/status`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: quotationKeys.detail(variables.id) });
    },
  });
}

export function useConvertToInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quotationId, ...data }: ConvertToInvoiceInput) =>
      api.post<{ invoice: { id: string }; quotation: Quotation }>(
        `/quotations/${quotationId}/convert-to-invoice`,
        data
      ),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: quotationKeys.detail(variables.quotationId) });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}

export function useDeleteQuotation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/quotations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
    },
  });
}
