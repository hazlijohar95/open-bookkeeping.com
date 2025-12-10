/**
 * Developer Portal API Hooks
 * Hooks for API Keys and Webhooks management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ==========================================
// Types
// ==========================================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Full key, only shown once on creation
}

export interface CreateApiKeyInput {
  name: string;
  permissions?: string[];
  rateLimit?: number;
  expiresInDays?: number;
}

export interface UpdateApiKeyInput {
  name?: string;
  permissions?: string[];
  rateLimit?: number;
  isActive?: boolean;
}

export interface ApiKeyUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  requestsByEndpoint: Record<string, number>;
  requestsByDay: Array<{ date: string; count: number }>;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: WebhookStats;
}

export interface WebhookWithSecret extends Webhook {
  secret: string; // Only shown on creation
}

export interface WebhookStats {
  totalDeliveries: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  avgResponseTime: number;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
  description?: string;
}

export interface UpdateWebhookInput {
  url?: string;
  events?: string[];
  description?: string | null;
  isActive?: boolean;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  eventId: string;
  status: "pending" | "success" | "failed" | "retrying";
  statusCode: number | null;
  responseTimeMs: number | null;
  attempts: number;
  errorMessage: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface WebhookEvent {
  name: string;
  description: string;
}

export interface TestWebhookResult {
  success: boolean;
  statusCode?: number;
  responseTimeMs: number;
  error?: string;
  message: string;
}

// ==========================================
// Query Keys
// ==========================================

export const developerKeys = {
  all: ["developer"] as const,
  apiKeys: () => [...developerKeys.all, "api-keys"] as const,
  apiKeysList: () => [...developerKeys.apiKeys(), "list"] as const,
  apiKeyDetail: (id: string) => [...developerKeys.apiKeys(), id] as const,
  apiKeyUsage: (id: string) => [...developerKeys.apiKeys(), id, "usage"] as const,
  webhooks: () => [...developerKeys.all, "webhooks"] as const,
  webhooksList: () => [...developerKeys.webhooks(), "list"] as const,
  webhookDetail: (id: string) => [...developerKeys.webhooks(), id] as const,
  webhookDeliveries: (id: string) => [...developerKeys.webhooks(), id, "deliveries"] as const,
  webhookEvents: () => [...developerKeys.webhooks(), "events"] as const,
};

// ==========================================
// API Key Hooks
// ==========================================

const apiKeyCacheConfig = {
  staleTime: 30 * 1000, // 30 seconds
  gcTime: 5 * 60 * 1000, // 5 minutes
};

export function useApiKeys(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: developerKeys.apiKeysList(),
    queryFn: async () => {
      const response = await api.get<{ data: ApiKey[] }>("/api-keys");
      return response.data;
    },
    enabled: options?.enabled,
    ...apiKeyCacheConfig,
  });
}

export function useApiKey(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: developerKeys.apiKeyDetail(id),
    queryFn: async () => {
      const response = await api.get<{ data: ApiKey }>(`/api-keys/${id}`);
      return response.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...apiKeyCacheConfig,
  });
}

export function useApiKeyUsage(id: string, options?: { enabled?: boolean; days?: number }) {
  return useQuery({
    queryKey: developerKeys.apiKeyUsage(id),
    queryFn: async () => {
      const response = await api.get<{ data: ApiKeyUsageStats }>(`/api-keys/${id}/usage`, {
        days: options?.days ?? 30,
      });
      return response.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const response = await api.post<{ data: ApiKeyWithSecret }>("/api-keys", input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: developerKeys.apiKeysList() });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateApiKeyInput & { id: string }) => {
      const response = await api.patch<{ data: ApiKey }>(`/api-keys/${id}`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: developerKeys.apiKeysList() });
      queryClient.invalidateQueries({ queryKey: developerKeys.apiKeyDetail(variables.id) });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: developerKeys.apiKeysList() });
    },
  });
}

export function useRegenerateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ data: ApiKeyWithSecret }>(`/api-keys/${id}/regenerate`);
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: developerKeys.apiKeysList() });
      queryClient.invalidateQueries({ queryKey: developerKeys.apiKeyDetail(id) });
    },
  });
}

// ==========================================
// Webhook Hooks
// ==========================================

const webhookCacheConfig = {
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
};

export function useWebhooks(options?: { enabled?: boolean; includeInactive?: boolean }) {
  return useQuery({
    queryKey: developerKeys.webhooksList(),
    queryFn: async () => {
      const response = await api.get<{ data: Webhook[] }>("/webhooks", {
        inactive: options?.includeInactive ? "true" : undefined,
      });
      return response.data;
    },
    enabled: options?.enabled,
    ...webhookCacheConfig,
  });
}

export function useWebhook(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: developerKeys.webhookDetail(id),
    queryFn: async () => {
      const response = await api.get<{ data: Webhook & { stats: WebhookStats } }>(`/webhooks/${id}`);
      return response.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    ...webhookCacheConfig,
  });
}

export function useWebhookDeliveries(
  webhookId: string,
  options?: { enabled?: boolean; status?: string; limit?: number }
) {
  return useQuery({
    queryKey: developerKeys.webhookDeliveries(webhookId),
    queryFn: async () => {
      const response = await api.get<{ data: WebhookDelivery[] }>(`/webhooks/${webhookId}/deliveries`, {
        status: options?.status,
        limit: options?.limit ?? 50,
      });
      return response.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled && !!webhookId : !!webhookId,
    staleTime: 15 * 1000, // 15 seconds - deliveries change frequently
  });
}

export function useWebhookEvents() {
  return useQuery({
    queryKey: developerKeys.webhookEvents(),
    queryFn: async () => {
      const response = await api.get<{ data: { events: string[]; grouped: Record<string, string[]> } }>(
        "/webhooks/events"
      );
      return response.data;
    },
    staleTime: Infinity, // Events don't change
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWebhookInput) => {
      const response = await api.post<{ data: WebhookWithSecret }>("/webhooks", input);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: developerKeys.webhooksList() });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateWebhookInput & { id: string }) => {
      const response = await api.patch<{ data: Webhook }>(`/webhooks/${id}`, input);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: developerKeys.webhooksList() });
      queryClient.invalidateQueries({ queryKey: developerKeys.webhookDetail(variables.id) });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: developerKeys.webhooksList() });
    },
  });
}

export function useRotateWebhookSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ data: { id: string; secret: string } }>(
        `/webhooks/${id}/rotate-secret`
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: developerKeys.webhookDetail(id) });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ data: TestWebhookResult }>(`/webhooks/${id}/test`);
      return response.data;
    },
  });
}
