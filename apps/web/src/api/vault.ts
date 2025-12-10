/**
 * Vault (Document Storage) API hooks
 * React Query hooks for document management and processing
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const vaultKeys = {
  all: ["vault"] as const,
  lists: () => [...vaultKeys.all, "list"] as const,
  list: (category?: string) => [...vaultKeys.lists(), category] as const,
  details: () => [...vaultKeys.all, "detail"] as const,
  detail: (id: string) => [...vaultKeys.details(), id] as const,
  search: (query: string) => [...vaultKeys.all, "search", query] as const,
  counts: () => [...vaultKeys.all, "counts"] as const,
  processingAvailable: () => [...vaultKeys.all, "processingAvailable"] as const,
  processingResult: (id: string) => [...vaultKeys.all, "processingResult", id] as const,
  processingHistory: (id: string) => [...vaultKeys.all, "processingHistory", id] as const,
  vendorsForMatching: () => [...vaultKeys.all, "vendorsForMatching"] as const,
};

// Types
export type DocumentCategory =
  | "contracts"
  | "receipts"
  | "images"
  | "invoices"
  | "bills"
  | "statements"
  | "tax_documents"
  | "other";

export type ProcessingStatus =
  | "unprocessed"
  | "queued"
  | "processing"
  | "processed"
  | "failed";

export interface VaultDocument {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  category: DocumentCategory;
  mimeType: string;
  size: number;
  storagePath: string;
  storageBucket: string;
  publicUrl: string | null;
  processingStatus: ProcessingStatus;
  lastProcessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ tag: string }>;
}

export interface UploadDocumentInput {
  fileName: string;
  mimeType: string;
  base64: string;
  tags?: string[];
}

export interface DocumentCounts {
  all: number;
  contracts: number;
  receipts: number;
  images: number;
  invoices: number;
  bills: number;
  statements: number;
  tax_documents: number;
  other: number;
}

export interface ProcessingResult {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  extractedData?: any; // Full extracted data structure from backend
  matchedVendor?: {
    id: string;
    name: string;
    email?: string;
  };
  linkedBillId?: string | null;
  confidenceScore?: string | null;
  processingDurationMs?: number | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ProcessingJob {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface VendorForMatching {
  id: string;
  name: string;
  email?: string;
  taxId?: string;
}

// Cache config for vault queries
const vaultCacheConfig = {
  staleTime: 5 * 60 * 1000,        // 5 minutes - documents don't change often
  gcTime: 15 * 60 * 1000,          // 15 minutes cache retention
  refetchOnMount: false,            // Use cache on navigation
  refetchOnWindowFocus: false,      // Don't refetch on tab switch
};

// Hooks
export function useVaultDocuments(category?: DocumentCategory) {
  return useQuery({
    queryKey: vaultKeys.list(category),
    queryFn: () => api.get<VaultDocument[]>("/vault", { category }),
    ...vaultCacheConfig,
  });
}

export function useVaultDocument(id: string) {
  return useQuery({
    queryKey: vaultKeys.detail(id),
    queryFn: () => api.get<VaultDocument>(`/vault/${id}`),
    enabled: !!id,
    ...vaultCacheConfig,
  });
}

export function useSearchVaultDocuments(query: string) {
  return useQuery({
    queryKey: vaultKeys.search(query),
    queryFn: () => api.get<VaultDocument[]>("/vault/search", { q: query }),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,           // 30 seconds for search
    refetchOnMount: false,
  });
}

export function useDocumentCounts() {
  return useQuery({
    queryKey: vaultKeys.counts(),
    queryFn: () => api.get<DocumentCounts>("/vault/counts"),
    ...vaultCacheConfig,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UploadDocumentInput) =>
      api.post<VaultDocument>("/vault", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.lists() });
      queryClient.invalidateQueries({ queryKey: vaultKeys.counts() });
    },
  });
}

export function useRenameDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, displayName }: { id: string; displayName: string }) =>
      api.patch<VaultDocument>(`/vault/${id}/rename`, { displayName }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.lists() });
      queryClient.invalidateQueries({ queryKey: vaultKeys.detail(variables.id) });
    },
  });
}

export function useUpdateDocumentTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      api.patch<{ success: boolean }>(`/vault/${id}/tags`, { tags }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.lists() });
      queryClient.invalidateQueries({ queryKey: vaultKeys.detail(variables.id) });
    },
  });
}

export function useChangeDocumentCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: DocumentCategory }) =>
      api.patch<VaultDocument>(`/vault/${id}/category`, { category }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.lists() });
      queryClient.invalidateQueries({ queryKey: vaultKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: vaultKeys.counts() });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/vault/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.lists() });
      queryClient.invalidateQueries({ queryKey: vaultKeys.counts() });
    },
  });
}

// Document Processing
export function useProcessingAvailable() {
  return useQuery({
    queryKey: vaultKeys.processingAvailable(),
    queryFn: () => api.get<{ available: boolean }>("/vault/processing/available"),
    staleTime: Infinity,
  });
}

export function useProcessDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) =>
      api.post<{ jobId: string; status: string; message: string }>(`/vault/${documentId}/process`),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.processingResult(documentId) });
      queryClient.invalidateQueries({ queryKey: vaultKeys.processingHistory(documentId) });
    },
  });
}

export function useProcessingResult(documentId: string) {
  return useQuery({
    queryKey: vaultKeys.processingResult(documentId),
    queryFn: () => api.get<ProcessingResult | null>(`/vault/${documentId}/processing-result`),
    enabled: !!documentId,
    ...vaultCacheConfig,
  });
}

export function useProcessingHistory(documentId: string) {
  return useQuery({
    queryKey: vaultKeys.processingHistory(documentId),
    queryFn: () => api.get<ProcessingJob[]>(`/vault/${documentId}/processing-history`),
    enabled: !!documentId,
    ...vaultCacheConfig,
  });
}

export function useCreateBillFromDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      vendorId,
      createVendorIfNotFound = true,
    }: {
      documentId: string;
      vendorId?: string;
      createVendorIfNotFound?: boolean;
    }) =>
      api.post<{ billId: string; message: string }>(`/vault/${documentId}/create-bill`, {
        vendorId,
        createVendorIfNotFound,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vaultKeys.processingResult(variables.documentId) });
      queryClient.invalidateQueries({ queryKey: ["bills"] }); // Invalidate bills list
    },
  });
}

export function useVendorsForMatching() {
  return useQuery({
    queryKey: vaultKeys.vendorsForMatching(),
    queryFn: () => api.get<VendorForMatching[]>("/vault/vendors-for-matching"),
    ...vaultCacheConfig,
  });
}
