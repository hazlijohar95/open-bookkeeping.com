/**
 * React Query hooks for Admin API
 * Uses tRPC React Query hooks for type-safe API calls
 */

import { trpc } from "@/trpc/provider";

// ============================================
// TYPES
// ============================================

export interface UserQueryFilters {
  search?: string;
  role?: "superadmin" | "admin" | "user" | "viewer";
  isSuspended?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "lastActiveAt" | "email" | "name";
  sortOrder?: "asc" | "desc";
}

export interface OrganizationQueryFilters {
  search?: string;
  subscriptionStatus?: string;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

export interface AuditLogQueryFilters {
  action?: "user_role_changed" | "user_suspended" | "user_unsuspended" | "user_deleted" |
           "org_created" | "org_updated" | "org_deleted" | "org_subscription_changed" |
           "system_setting_updated" | "feature_flag_toggled" | "maintenance_mode_toggled" |
           "quota_override_set" | "quota_override_removed" | "api_key_revoked" | "session_terminated";
  targetType?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// USER MANAGEMENT HOOKS
// ============================================

export function useAdminUsers(filters?: UserQueryFilters) {
  return trpc.admin.listUsers.useQuery(filters);
}

export function useAdminUser(id: string) {
  return trpc.admin.getUser.useQuery(id, {
    enabled: !!id,
  });
}

export function useUpdateUserRole() {
  const utils = trpc.useUtils();

  return trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      void utils.admin.listUsers.invalidate();
    },
  });
}

export function useSuspendUser() {
  const utils = trpc.useUtils();

  return trpc.admin.suspendUser.useMutation({
    onSuccess: () => {
      void utils.admin.listUsers.invalidate();
    },
  });
}

export function useUnsuspendUser() {
  const utils = trpc.useUtils();

  return trpc.admin.unsuspendUser.useMutation({
    onSuccess: () => {
      void utils.admin.listUsers.invalidate();
    },
  });
}

// ============================================
// ORGANIZATION HOOKS
// ============================================

export function useAdminOrganizations(filters?: OrganizationQueryFilters) {
  return trpc.admin.listOrganizations.useQuery(filters);
}

export function useAdminOrganization(id: string) {
  return trpc.admin.getOrganization.useQuery(id, {
    enabled: !!id,
  });
}

// ============================================
// PLATFORM STATS HOOKS
// ============================================

export function usePlatformStats() {
  return trpc.admin.getPlatformStats.useQuery(undefined, {
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useUserGrowth(days = 30) {
  return trpc.admin.getUserGrowth.useQuery({ days }, {
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// AUDIT LOG HOOKS
// ============================================

export function useAdminAuditLogs(filters?: AuditLogQueryFilters) {
  return trpc.admin.getAuditLogs.useQuery(filters);
}

export function useAdminAuditLog(id: string) {
  return trpc.admin.getAuditLog.useQuery(id, {
    enabled: !!id,
  });
}

// ============================================
// SYSTEM SETTINGS HOOKS
// ============================================

export function useSystemSettings() {
  return trpc.admin.getSystemSettings.useQuery();
}

export function useUpdateSystemSettings() {
  const utils = trpc.useUtils();

  return trpc.admin.updateSystemSettings.useMutation({
    onSuccess: () => {
      void utils.admin.getSystemSettings.invalidate();
    },
  });
}

// ============================================
// FEATURE FLAGS HOOKS
// ============================================

export function useFeatureFlags() {
  return trpc.admin.listFeatureFlags.useQuery();
}

export function useToggleFeatureFlag() {
  const utils = trpc.useUtils();

  return trpc.admin.toggleFeatureFlag.useMutation({
    onSuccess: () => {
      void utils.admin.listFeatureFlags.invalidate();
    },
  });
}

export function useCreateFeatureFlag() {
  const utils = trpc.useUtils();

  return trpc.admin.createFeatureFlag.useMutation({
    onSuccess: () => {
      void utils.admin.listFeatureFlags.invalidate();
    },
  });
}

// ============================================
// USER QUOTAS HOOKS
// ============================================

export interface UserQuotaUpdate {
  userId: string;
  dailyInvoiceLimit?: number;
  dailyBillLimit?: number;
  dailyJournalEntryLimit?: number;
  dailyQuotationLimit?: number;
  dailyTokenLimit?: number;
  maxSingleInvoiceAmount?: string | null;
  maxSingleBillAmount?: string | null;
  maxDailyTotalAmount?: string | null;
  maxActionsPerMinute?: number;
}

export function useUserQuotas(userId: string) {
  return trpc.admin.getUserQuotas.useQuery(userId, {
    enabled: !!userId,
  });
}

export function useUpdateUserQuotas() {
  const utils = trpc.useUtils();

  return trpc.admin.updateUserQuotas.useMutation({
    onSuccess: (_, variables) => {
      void utils.admin.getUserQuotas.invalidate(variables.userId);
      void utils.admin.getUser.invalidate(variables.userId);
    },
  });
}

export function useEnableEmergencyStop() {
  const utils = trpc.useUtils();

  return trpc.admin.enableEmergencyStop.useMutation({
    onSuccess: (_, variables) => {
      void utils.admin.getUserQuotas.invalidate(variables.userId);
    },
  });
}

export function useDisableEmergencyStop() {
  const utils = trpc.useUtils();

  return trpc.admin.disableEmergencyStop.useMutation({
    onSuccess: (_, variables) => {
      void utils.admin.getUserQuotas.invalidate(variables.userId);
    },
  });
}

export function useResetUserDailyUsage() {
  const utils = trpc.useUtils();

  return trpc.admin.resetUserDailyUsage.useMutation({
    onSuccess: (_, variables) => {
      void utils.admin.getUserQuotas.invalidate(variables.userId);
    },
  });
}
