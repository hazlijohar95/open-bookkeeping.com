/**
 * Fixed Asset API hooks
 * React Query hooks for fixed asset CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const fixedAssetKeys = {
  all: ["fixed-assets"] as const,
  lists: () => [...fixedAssetKeys.all, "list"] as const,
  list: (params?: FixedAssetListParams) => [...fixedAssetKeys.lists(), params] as const,
  details: () => [...fixedAssetKeys.all, "detail"] as const,
  detail: (id: string) => [...fixedAssetKeys.details(), id] as const,
  summary: () => [...fixedAssetKeys.all, "summary"] as const,
  pendingDepreciations: (beforeDate?: string) =>
    [...fixedAssetKeys.all, "pendingDepreciations", beforeDate] as const,
  depreciationSchedule: (assetId: string) =>
    [...fixedAssetKeys.all, "depreciationSchedule", assetId] as const,
  categories: () => [...fixedAssetKeys.all, "categories"] as const,
  category: (id: string) => [...fixedAssetKeys.all, "category", id] as const,
};

// Types
export type DepreciationMethod = "straight_line" | "declining_balance" | "double_declining";
export type AcquisitionMethod = "purchase" | "donation" | "transfer" | "lease_to_own";
export type FixedAssetStatus = "draft" | "active" | "fully_depreciated" | "disposed";
export type DisposalMethod = "sale" | "scrapped" | "donation" | "trade_in";
export type DepreciationScheduleStatus = "scheduled" | "posted" | "skipped";

export interface FixedAssetListParams {
  limit?: number;
  offset?: number;
  status?: FixedAssetStatus;
  categoryId?: string;
  search?: string;
}

export interface FixedAssetCategory {
  id: string;
  userId: string;
  code: string;
  name: string;
  description: string | null;
  defaultUsefulLifeMonths: number | null;
  defaultDepreciationMethod: DepreciationMethod | null;
  defaultAssetAccountId: string | null;
  defaultDepreciationExpenseAccountId: string | null;
  defaultAccumulatedDepreciationAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FixedAsset {
  id: string;
  userId: string;
  assetCode: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  acquisitionDate: string;
  acquisitionCost: string;
  acquisitionMethod: AcquisitionMethod;
  vendorId: string | null;
  invoiceReference: string | null;
  depreciationMethod: DepreciationMethod;
  usefulLifeMonths: number;
  salvageValue: string;
  depreciationStartDate: string;
  accumulatedDepreciation: string;
  netBookValue: string;
  lastDepreciationDate: string | null;
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
  status: FixedAssetStatus;
  location: string | null;
  serialNumber: string | null;
  warrantyExpiry: string | null;
  metadata: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  category?: FixedAssetCategory | null;
  vendor?: { id: string; name: string } | null;
}

export interface FixedAssetDepreciation {
  id: string;
  fixedAssetId: string;
  year: number;
  periodStart: string;
  periodEnd: string;
  depreciationAmount: string;
  accumulatedDepreciation: string;
  netBookValue: string;
  journalEntryId: string | null;
  status: DepreciationScheduleStatus;
  notes: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface FixedAssetDisposal {
  id: string;
  fixedAssetId: string;
  disposalDate: string;
  disposalMethod: DisposalMethod;
  proceeds: string;
  netBookValueAtDisposal: string;
  gainLoss: string;
  buyerInfo: { name?: string; contact?: string; reference?: string } | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FixedAssetSummary {
  totalAssets: number;
  totalCost: string;
  totalAccumulatedDepreciation: string;
  totalNetBookValue: string;
  byStatus: {
    draft: number;
    active: number;
    fullyDepreciated: number;
    disposed: number;
  };
}

export interface CreateFixedAssetInput {
  name: string;
  description?: string;
  categoryId?: string;
  acquisitionDate: string;
  acquisitionCost: string;
  acquisitionMethod?: AcquisitionMethod;
  vendorId?: string;
  invoiceReference?: string;
  depreciationMethod?: DepreciationMethod;
  usefulLifeMonths: number;
  salvageValue?: string;
  depreciationStartDate: string;
  assetAccountId: string;
  depreciationExpenseAccountId: string;
  accumulatedDepreciationAccountId: string;
  location?: string;
  serialNumber?: string;
  warrantyExpiry?: string;
  metadata?: Record<string, string>;
}

export interface UpdateFixedAssetInput {
  name?: string;
  description?: string | null;
  location?: string;
  serialNumber?: string;
  metadata?: Record<string, string>;
}

export interface DisposeAssetInput {
  disposalDate: string;
  disposalMethod: DisposalMethod;
  proceeds?: string;
  buyerInfo?: { name?: string; contact?: string; reference?: string };
  notes?: string;
}

export interface CreateCategoryInput {
  code: string;
  name: string;
  description?: string;
  defaultUsefulLifeMonths?: number;
  defaultDepreciationMethod?: DepreciationMethod;
  defaultAssetAccountId?: string;
  defaultDepreciationExpenseAccountId?: string;
  defaultAccumulatedDepreciationAccountId?: string;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {}

export interface DepreciationPreviewInput {
  acquisitionCost: string;
  salvageValue?: string;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  depreciationStartDate: string;
}

export interface DepreciationPreviewItem {
  year: number;
  periodStart: string;
  periodEnd: string;
  depreciationAmount: string;
  accumulatedDepreciation: string;
  netBookValue: string;
}

// Cache config
const assetCacheConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 15 * 60 * 1000, // 15 minutes
  refetchOnMount: false,
  refetchOnWindowFocus: false,
};

// ============================================================================
// Asset Hooks
// ============================================================================

export function useFixedAssets(options?: FixedAssetListParams & { enabled?: boolean }) {
  return useQuery({
    queryKey: fixedAssetKeys.list(options),
    queryFn: () =>
      api.get<{ assets: FixedAsset[]; total: number }>("/fixed-assets", {
        limit: options?.limit,
        offset: options?.offset,
        status: options?.status,
        categoryId: options?.categoryId,
        search: options?.search,
      }),
    enabled: options?.enabled,
    ...assetCacheConfig,
  });
}

export function useFixedAsset(id: string) {
  return useQuery({
    queryKey: fixedAssetKeys.detail(id),
    queryFn: () => api.get<FixedAsset>(`/fixed-assets/${id}`),
    enabled: !!id,
    ...assetCacheConfig,
  });
}

export function useFixedAssetSummary() {
  return useQuery({
    queryKey: fixedAssetKeys.summary(),
    queryFn: () => api.get<FixedAssetSummary>("/fixed-assets/summary"),
    ...assetCacheConfig,
  });
}

export function usePendingDepreciations(beforeDate?: string) {
  return useQuery({
    queryKey: fixedAssetKeys.pendingDepreciations(beforeDate),
    queryFn: () =>
      api.get<(FixedAssetDepreciation & { fixedAsset?: FixedAsset })[]>(
        "/fixed-assets/pending-depreciations",
        { beforeDate }
      ),
    ...assetCacheConfig,
  });
}

export function useDepreciationSchedule(assetId: string) {
  return useQuery({
    queryKey: fixedAssetKeys.depreciationSchedule(assetId),
    queryFn: () => api.get<FixedAssetDepreciation[]>(`/fixed-assets/${assetId}/depreciation-schedule`),
    enabled: !!assetId,
    ...assetCacheConfig,
  });
}

export function useCreateFixedAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFixedAssetInput) =>
      api.post<FixedAsset>("/fixed-assets", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.summary() });
    },
  });
}

export function useUpdateFixedAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateFixedAssetInput & { id: string }) =>
      api.patch<FixedAsset>(`/fixed-assets/${id}`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.detail(variables.id) });
    },
  });
}

export function useDeleteFixedAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/fixed-assets/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.summary() });
    },
  });
}

export function useActivateFixedAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.post<FixedAsset>(`/fixed-assets/${id}/activate`),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.summary() });
    },
  });
}

export function useDisposeFixedAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: DisposeAssetInput & { id: string }) =>
      api.post<FixedAssetDisposal>(`/fixed-assets/${id}/dispose`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.detail(variables.id) });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.summary() });
    },
  });
}

export function usePreviewDepreciation() {
  return useMutation({
    mutationFn: (input: DepreciationPreviewInput) =>
      api.post<DepreciationPreviewItem[]>("/fixed-assets/preview-depreciation", input),
  });
}

export function useRunDepreciation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (depreciationId: string) =>
      api.post<{ success: boolean; journalEntryId: string }>(
        `/fixed-assets/depreciation/${depreciationId}/run`
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.all });
    },
  });
}

export function useSkipDepreciation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post<FixedAssetDepreciation>(`/fixed-assets/depreciation/${id}/skip`, { notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.all });
    },
  });
}

// ============================================================================
// Category Hooks
// ============================================================================

export function useFixedAssetCategories() {
  return useQuery({
    queryKey: fixedAssetKeys.categories(),
    queryFn: () => api.get<FixedAssetCategory[]>("/fixed-assets/categories"),
    ...assetCacheConfig,
  });
}

export function useFixedAssetCategory(id: string) {
  return useQuery({
    queryKey: fixedAssetKeys.category(id),
    queryFn: () => api.get<FixedAssetCategory>(`/fixed-assets/categories/${id}`),
    enabled: !!id,
    ...assetCacheConfig,
  });
}

export function useCreateFixedAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) =>
      api.post<FixedAssetCategory>("/fixed-assets/categories", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.categories() });
    },
  });
}

export function useUpdateFixedAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCategoryInput & { id: string }) =>
      api.patch<FixedAssetCategory>(`/fixed-assets/categories/${id}`, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.categories() });
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.category(variables.id) });
    },
  });
}

export function useDeleteFixedAssetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/fixed-assets/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fixedAssetKeys.categories() });
    },
  });
}
