/**
 * Invoice API hooks
 * React Query hooks for invoice CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PaginatedResponse, type PaginationParams } from "@/lib/api-client";

// Query keys
export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (params?: InvoiceListParams) => [...invoiceKeys.lists(), params] as const,
  listLight: () => [...invoiceKeys.all, "listLight"] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  byCustomer: (customerId: string) => [...invoiceKeys.all, "byCustomer", customerId] as const,
  unpaid: () => [...invoiceKeys.all, "unpaid"] as const,
  agingReport: () => [...invoiceKeys.all, "agingReport"] as const,
};

// Types
export interface InvoiceListParams extends PaginationParams {
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// Shared metadata item type
interface MetadataItem {
  label: string;
  value: string;
}

// Billing detail with SST support
interface BillingDetail {
  label: string;
  value: number | string;
  type: string;
  isSstTax?: boolean;
  sstTaxType?: string;
  sstRateCode?: string;
}

// Invoice item type
interface InvoiceItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number | string;
}

export interface Invoice {
  id: string;
  userId: string;
  customerId?: string | null;
  status: "draft" | "pending" | "sent" | "paid" | "overdue" | "cancelled";
  einvoiceStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  invoiceFields?: {
    companyDetails?: {
      name: string;
      address: string;
      logo?: string | null;
      signature?: string | null;
      metadata?: MetadataItem[];
    };
    clientDetails?: {
      name: string;
      address: string;
      metadata?: MetadataItem[];
    };
    invoiceDetails?: {
      theme?: {
        baseColor?: string;
        mode?: string;
        template?: string;
      };
      currency: string;
      prefix: string;
      serialNumber: string;
      poNumber?: string;
      referenceNumber?: string;
      date: string;
      dueDate?: string | null;
      paymentTerms?: string;
      billingDetails?: BillingDetail[];
    };
    items: InvoiceItem[];
    metadata?: {
      notes?: string;
      terms?: string;
      paymentInformation?: MetadataItem[];
    };
  } | null;
}

export interface InvoiceLightItem {
  id: string;
  status: string;
  customerId?: string | null;
  customerName?: string | null;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  total: number;
  createdAt: string;
}

export interface CreateInvoiceInput {
  customerId?: string | null;
  status?: string;
  invoiceDetails?: {
    prefix?: string;
    serialNumber?: string;
    date?: Date | string;
    dueDate?: Date | string | null;
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

export interface UpdateInvoiceStatusInput {
  id: string;
  status: string;
  paidAt?: string;
}

export interface AgingReport {
  current: Invoice[];
  "1-30": Invoice[];
  "31-60": Invoice[];
  "61-90": Invoice[];
  "90+": Invoice[];
}

// Cache config for invoice list queries - these are frequently accessed
const invoiceListCacheConfig = {
  staleTime: 3 * 60 * 1000,        // 3 minutes - invoices may change more often
  gcTime: 10 * 60 * 1000,          // 10 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useInvoices(options?: InvoiceListParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: invoiceKeys.list(options),
    queryFn: () =>
      api.get<Invoice[]>("/invoices", {
        limit: options?.limit,
        offset: options?.offset,
        customerId: options?.customerId,
        status: options?.status,
        startDate: options?.startDate,
        endDate: options?.endDate,
      }),
    enabled: options?.enabled,
    ...invoiceListCacheConfig,
  });
}

export function useInvoicesLight(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: invoiceKeys.listLight(),
    queryFn: () => api.get<InvoiceLightItem[]>("/invoices/light"),
    enabled: options?.enabled,
    ...invoiceListCacheConfig,
  });
}

export function useInvoice(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    staleTime: 5 * 60 * 1000,       // Individual invoice can be cached longer
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useInvoicesByCustomer(customerId: string, params?: PaginationParams) {
  return useQuery({
    queryKey: invoiceKeys.byCustomer(customerId),
    queryFn: () =>
      api.get<PaginatedResponse<Invoice>>(`/invoices/by-customer/${customerId}`, {
        limit: params?.limit,
        offset: params?.offset,
      }),
    enabled: !!customerId,
    ...invoiceListCacheConfig,
  });
}

export function useUnpaidInvoices(customerId?: string) {
  return useQuery({
    queryKey: invoiceKeys.unpaid(),
    queryFn: () =>
      api.get<Invoice[]>("/invoices/unpaid", { customerId }),
    ...invoiceListCacheConfig,
  });
}

export function useAgingReport(customerId?: string) {
  return useQuery({
    queryKey: invoiceKeys.agingReport(),
    queryFn: () =>
      api.get<AgingReport>("/invoices/aging-report", { customerId }),
    staleTime: 5 * 60 * 1000,       // Aging report changes slowly
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      api.post<Invoice>("/invoices", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.listLight() });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateInvoiceStatusInput) =>
      api.patch<Invoice>(`/invoices/${id}/status`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.listLight() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.listLight() });
    },
  });
}
