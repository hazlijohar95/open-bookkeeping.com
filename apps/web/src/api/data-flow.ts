/**
 * Data Flow API Hooks
 * React Query hooks for the Data Flow Explorer feature
 * Supports real-time polling for live updates
 */

import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/trpc/client";
import type { EventFilters } from "@/components/data-flow/shared/data-flow-types";

// ============================================
// QUERY KEYS (for manual invalidation)
// ============================================

const dataFlowKeys = {
  all: ["dataFlow"] as const,
  events: (filters?: EventFilters) => [...dataFlowKeys.all, "events", filters] as const,
  flowStats: (filters?: EventFilters) => [...dataFlowKeys.all, "flowStats", filters] as const,
  realtimeSummary: () => [...dataFlowKeys.all, "realtimeSummary"] as const,
};

// ============================================
// DEFAULT POLLING INTERVAL
// ============================================

const DEFAULT_POLLING_INTERVAL = 5000; // 5 seconds

// ============================================
// HOOKS (using tRPC React Query integration)
// ============================================

/**
 * Get unified events from all audit sources
 * Supports real-time polling
 */
export function useDataFlowEvents(
  filters?: EventFilters,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return trpc.dataFlow.getEvents.useQuery(filters, {
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? DEFAULT_POLLING_INTERVAL,
    staleTime: 1000, // Consider data stale after 1 second
  });
}

/**
 * Get flow statistics for Sankey diagram
 * Supports real-time polling
 */
export function useDataFlowStats(
  filters?: EventFilters,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  }
) {
  return trpc.dataFlow.getFlowStats.useQuery(filters, {
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? DEFAULT_POLLING_INTERVAL,
    staleTime: 1000,
  });
}

/**
 * Get a single event by ID
 */
export function useDataFlowEvent(
  eventId: string,
  source: "agent" | "user" | "admin",
  options?: { enabled?: boolean }
) {
  return trpc.dataFlow.getEvent.useQuery(
    { eventId, source },
    { enabled: options?.enabled ?? !!eventId }
  );
}

/**
 * Get available filter options
 */
export function useDataFlowFilterOptions(options?: { enabled?: boolean }) {
  return trpc.dataFlow.getFilterOptions.useQuery(undefined, {
    enabled: options?.enabled ?? true,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Get real-time summary statistics
 * Lightweight polling for header stats
 */
export function useDataFlowRealtimeSummary(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
}) {
  return trpc.dataFlow.getRealtimeSummary.useQuery(undefined, {
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? DEFAULT_POLLING_INTERVAL,
    staleTime: 1000,
  });
}

/**
 * Get educational content for a resource type
 */
export function useResourceTypeInfo(
  resourceType: string,
  options?: { enabled?: boolean }
) {
  return trpc.dataFlow.getResourceTypeInfo.useQuery(resourceType, {
    enabled: options?.enabled ?? !!resourceType,
    staleTime: Infinity, // Educational content doesn't change
  });
}

/**
 * Get educational content for an action type
 */
export function useActionTypeInfo(
  actionType: string,
  options?: { enabled?: boolean }
) {
  return trpc.dataFlow.getActionTypeInfo.useQuery(actionType, {
    enabled: options?.enabled ?? !!actionType,
    staleTime: Infinity, // Educational content doesn't change
  });
}

/**
 * Get entity relationships for the entity explorer
 */
export function useEntityRelationships(options?: { enabled?: boolean }) {
  return trpc.dataFlow.getEntityRelationships.useQuery(undefined, {
    enabled: options?.enabled ?? true,
    staleTime: Infinity, // Static data
  });
}

/**
 * Hook to manually invalidate all data flow queries
 * Useful for forcing a refresh
 */
export function useInvalidateDataFlow() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: dataFlowKeys.all }),
    invalidateEvents: (filters?: EventFilters) =>
      queryClient.invalidateQueries({ queryKey: dataFlowKeys.events(filters) }),
    invalidateFlowStats: (filters?: EventFilters) =>
      queryClient.invalidateQueries({ queryKey: dataFlowKeys.flowStats(filters) }),
    invalidateSummary: () =>
      queryClient.invalidateQueries({ queryKey: dataFlowKeys.realtimeSummary() }),
  };
}

/**
 * Hook to pause/resume polling based on visibility
 * Returns whether polling should be enabled
 */
export function usePollingControl(baseEnabled: boolean = true) {
  const isVisible = typeof document !== "undefined"
    ? document.visibilityState === "visible"
    : true;

  return baseEnabled && isVisible;
}
