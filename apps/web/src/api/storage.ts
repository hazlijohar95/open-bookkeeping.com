/**
 * Storage API hooks
 * React Query hooks for logo and signature image storage
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const storageKeys = {
  all: ["storage"] as const,
  images: () => [...storageKeys.all, "images"] as const,
  logos: () => [...storageKeys.all, "logos"] as const,
  signatures: () => [...storageKeys.all, "signatures"] as const,
};

// Cache configuration for static image data
const storageCacheConfig = {
  staleTime: 30 * 60 * 1000,  // 30 minutes
  gcTime: 60 * 60 * 1000,     // 1 hour
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
};

// Types
export interface StorageImage {
  key: string;
  name: string;
  type: "logo" | "signature";
  url: string;
  createdAt?: string;
}

export interface UploadImageInput {
  type: "logo" | "signature";
  base64: string;
  fileName: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

// Hooks
export function useStorageImages() {
  return useQuery({
    queryKey: storageKeys.images(),
    queryFn: () => api.get<StorageImage[]>("/storage"),
    ...storageCacheConfig,
  });
}

export function useLogos() {
  return useQuery({
    queryKey: storageKeys.logos(),
    queryFn: () => api.get<StorageImage[]>("/storage/logos"),
    ...storageCacheConfig,
  });
}

export function useSignatures() {
  return useQuery({
    queryKey: storageKeys.signatures(),
    queryFn: () => api.get<StorageImage[]>("/storage/signatures"),
    ...storageCacheConfig,
  });
}

export function useUploadImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UploadImageInput) =>
      api.post<UploadResult>("/storage", input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: storageKeys.images() });
      if (variables.type === "logo") {
        void queryClient.invalidateQueries({ queryKey: storageKeys.logos() });
      } else {
        void queryClient.invalidateQueries({ queryKey: storageKeys.signatures() });
      }
    },
  });
}

export function useDeleteImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) =>
      api.delete<{ success: boolean }>("/storage", { key }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
  });
}
