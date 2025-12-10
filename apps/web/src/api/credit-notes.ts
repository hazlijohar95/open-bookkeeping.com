/**
 * Credit Notes API hooks
 * React Query hooks for credit note CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CreditNoteStatusType, NoteReasonType } from "@/types/common/creditNote";

// Query keys
export const creditNoteKeys = {
  all: ["creditNotes"] as const,
  lists: () => [...creditNoteKeys.all, "list"] as const,
  details: () => [...creditNoteKeys.all, "detail"] as const,
  detail: (id: string) => [...creditNoteKeys.details(), id] as const,
};

// Types
export interface CreditNoteFields {
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
  creditNoteDetails?: {
    theme?: {
      baseColor?: string;
      mode?: string;
      template?: string;
    };
    currency: string;
    prefix: string;
    serialNumber: string;
    date: string;
    originalInvoiceNumber?: string;
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
  };
}

export interface CreditNote {
  id: string;
  userId: string;
  customerId?: string | null;
  reason: NoteReasonType;
  status: CreditNoteStatusType;
  issuedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  creditNoteFields?: CreditNoteFields | null;
}

export interface CreateCreditNoteInput {
  customerId?: string | null;
  reason: NoteReasonType;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number | string;
  }>;
  companyDetails?: Record<string, unknown>;
  clientDetails?: Record<string, unknown>;
  creditNoteDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateCreditNoteStatusInput {
  id: string;
  status: CreditNoteStatusType;
}

// Cache config for credit note queries
const creditNoteCacheConfig = {
  staleTime: 5 * 60 * 1000,        // 5 minutes
  gcTime: 10 * 60 * 1000,          // 10 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks

export function useCreditNotes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: creditNoteKeys.lists(),
    queryFn: () => api.get<CreditNote[]>("/credit-notes"),
    enabled: options?.enabled,
    ...creditNoteCacheConfig,
  });
}

export function useCreditNote(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: creditNoteKeys.detail(id),
    queryFn: () => api.get<CreditNote>(`/credit-notes/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...creditNoteCacheConfig,
  });
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCreditNoteInput) =>
      api.post<CreditNote>("/credit-notes", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.lists() });
    },
  });
}

export function useUpdateCreditNoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: UpdateCreditNoteStatusInput) =>
      api.patch<CreditNote>(`/credit-notes/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCreditNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.delete<{ success: boolean }>(`/credit-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.lists() });
    },
  });
}
