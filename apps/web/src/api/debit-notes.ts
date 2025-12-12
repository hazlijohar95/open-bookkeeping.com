/**
 * Debit Notes API hooks
 * React Query hooks for debit note CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DebitNoteStatusType, NoteReasonType } from "@/types/common/debitNote";

// Query keys
export const debitNoteKeys = {
  all: ["debitNotes"] as const,
  lists: () => [...debitNoteKeys.all, "list"] as const,
  details: () => [...debitNoteKeys.all, "detail"] as const,
  detail: (id: string) => [...debitNoteKeys.details(), id] as const,
};

// Types
export interface DebitNoteFields {
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
  debitNoteDetails?: {
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

export interface DebitNote {
  id: string;
  userId: string;
  customerId?: string | null;
  reason: NoteReasonType;
  status: DebitNoteStatusType;
  issuedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  debitNoteFields?: DebitNoteFields | null;
}

export interface CreateDebitNoteInput {
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
  debitNoteDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateDebitNoteStatusInput {
  id: string;
  status: DebitNoteStatusType;
}

// Cache config for debit note queries
const debitNoteCacheConfig = {
  staleTime: 5 * 60 * 1000,        // 5 minutes
  gcTime: 10 * 60 * 1000,          // 10 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks

export function useDebitNotes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: debitNoteKeys.lists(),
    queryFn: () => api.get<DebitNote[]>("/debit-notes"),
    enabled: options?.enabled,
    ...debitNoteCacheConfig,
  });
}

export function useDebitNote(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: debitNoteKeys.detail(id),
    queryFn: () => api.get<DebitNote>(`/debit-notes/${id}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...debitNoteCacheConfig,
  });
}

export function useCreateDebitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDebitNoteInput) =>
      api.post<DebitNote>("/debit-notes", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debitNoteKeys.lists() });
    },
  });
}

export function useUpdateDebitNoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: UpdateDebitNoteStatusInput) =>
      api.patch<DebitNote>(`/debit-notes/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: debitNoteKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: debitNoteKeys.detail(variables.id) });
    },
  });
}

export function useDeleteDebitNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.delete<{ success: boolean }>(`/debit-notes/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debitNoteKeys.lists() });
    },
  });
}
