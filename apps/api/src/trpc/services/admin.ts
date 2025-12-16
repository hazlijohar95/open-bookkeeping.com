/**
 * Admin tRPC Router
 * Provides superadmin API endpoints for platform management
 */

import { z } from "zod";
import { router, superadminProcedure } from "../trpc";
import { adminService } from "../../services/admin.service";
import { adminAuditService } from "../../services/admin-audit.service";
import { agentSafetyService } from "../../services/agent-safety.service";
import { invalidateUserSessions } from "../context";
import type { UserRole } from "@open-bookkeeping/db";

// ============================================
// INPUT SCHEMAS
// ============================================

const userQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["superadmin", "admin", "user", "viewer"]).optional(),
  isSuspended: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortBy: z
    .enum(["createdAt", "lastActiveAt", "email", "name"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const organizationQuerySchema = z.object({
  search: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum(["superadmin", "admin", "user", "viewer"]),
  reason: z.string().optional(),
});

const suspendUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required"),
});

const unsuspendUserSchema = z.object({
  userId: z.string().uuid(),
});

const adminActionTypes = [
  "user_role_changed",
  "user_suspended",
  "user_unsuspended",
  "user_deleted",
  "org_created",
  "org_updated",
  "org_deleted",
  "org_subscription_changed",
  "system_setting_updated",
  "feature_flag_toggled",
  "maintenance_mode_toggled",
  "quota_override_set",
  "quota_override_removed",
  "api_key_revoked",
  "session_terminated",
] as const;

const auditLogQuerySchema = z.object({
  action: z.enum(adminActionTypes).optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

const systemSettingsUpdateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
  announcementEnabled: z.boolean().optional(),
  announcementMessage: z.string().optional(),
  announcementType: z.enum(["info", "warning", "error"]).optional(),
  defaultRateLimitPerMinute: z.number().optional(),
  defaultRateLimitPerHour: z.number().optional(),
  defaultDailyInvoiceLimit: z.number().optional(),
  defaultDailyBillLimit: z.number().optional(),
  defaultDailyTokenLimit: z.number().optional(),
  sessionTimeoutMinutes: z.number().optional(),
  require2FA: z.boolean().optional(),
  allowNewSignups: z.boolean().optional(),
  trialDurationDays: z.number().optional(),
});

const toggleFeatureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
});

const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isEnabled: z.boolean().default(false),
  targetRules: z.record(z.string(), z.unknown()).optional(),
});

const updateUserQuotasSchema = z.object({
  userId: z.string().uuid(),
  dailyInvoiceLimit: z.number().min(1).max(10000).optional(),
  dailyBillLimit: z.number().min(1).max(10000).optional(),
  dailyJournalEntryLimit: z.number().min(1).max(10000).optional(),
  dailyQuotationLimit: z.number().min(1).max(10000).optional(),
  dailyTokenLimit: z.number().min(1000).max(100000000).optional(),
  maxSingleInvoiceAmount: z.string().nullable().optional(),
  maxSingleBillAmount: z.string().nullable().optional(),
  maxDailyTotalAmount: z.string().nullable().optional(),
  maxActionsPerMinute: z.number().min(1).max(100).optional(),
});

const emergencyStopSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

// ============================================
// ROUTER
// ============================================

export const adminRouter = router({
  // ========== USER MANAGEMENT ==========

  /**
   * List all users with filtering and pagination
   */
  listUsers: superadminProcedure
    .input(userQuerySchema.optional())
    .query(async ({ input }) => {
      return adminService.listUsers(input ?? {});
    }),

  /**
   * Get detailed user information
   */
  getUser: superadminProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return adminService.getUserDetails(input);
    }),

  /**
   * Update user role
   */
  updateUserRole: superadminProcedure
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      return adminService.updateUserRole({
        userId: input.userId,
        newRole: input.newRole as UserRole,
        adminId: ctx.user.id,
        reason: input.reason,
      });
    }),

  /**
   * Suspend a user
   */
  suspendUser: superadminProcedure
    .input(suspendUserSchema)
    .mutation(async ({ ctx, input }) => {
      return adminService.suspendUser({
        userId: input.userId,
        reason: input.reason,
        adminId: ctx.user.id,
      });
    }),

  /**
   * Unsuspend a user
   */
  unsuspendUser: superadminProcedure
    .input(unsuspendUserSchema)
    .mutation(async ({ ctx, input }) => {
      return adminService.unsuspendUser({
        userId: input.userId,
        adminId: ctx.user.id,
      });
    }),

  // ========== ORGANIZATION MANAGEMENT ==========

  /**
   * List all organizations
   */
  listOrganizations: superadminProcedure
    .input(organizationQuerySchema.optional())
    .query(async ({ input }) => {
      return adminService.listOrganizations(input ?? {});
    }),

  /**
   * Get organization details
   */
  getOrganization: superadminProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return adminService.getOrganizationDetails(input);
    }),

  // ========== PLATFORM STATS ==========

  /**
   * Get platform-wide statistics
   */
  getPlatformStats: superadminProcedure.query(async () => {
    return adminService.getPlatformStats();
  }),

  /**
   * Get user growth over time
   */
  getUserGrowth: superadminProcedure
    .input(
      z.object({ days: z.number().min(1).max(365).default(30) }).optional()
    )
    .query(async ({ input }) => {
      return adminService.getUserGrowth(input?.days ?? 30);
    }),

  // ========== AUDIT LOGS ==========

  /**
   * Get admin audit logs
   */
  getAuditLogs: superadminProcedure
    .input(auditLogQuerySchema.optional())
    .query(async ({ input }) => {
      return adminAuditService.getLogs(input ?? {});
    }),

  /**
   * Get a single audit log
   */
  getAuditLog: superadminProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return adminAuditService.getLogById(input);
    }),

  /**
   * Get audit log statistics
   */
  getAuditStats: superadminProcedure
    .input(
      z
        .object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return adminAuditService.getStats(input?.startDate, input?.endDate);
    }),

  // ========== SYSTEM SETTINGS ==========

  /**
   * Get system settings
   */
  getSystemSettings: superadminProcedure.query(async () => {
    return adminService.getSystemSettings();
  }),

  /**
   * Update system settings
   */
  updateSystemSettings: superadminProcedure
    .input(systemSettingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return adminService.updateSystemSettings(ctx.user.id, input);
    }),

  // ========== FEATURE FLAGS ==========

  /**
   * List all feature flags
   */
  listFeatureFlags: superadminProcedure.query(async () => {
    return adminService.listFeatureFlags();
  }),

  /**
   * Toggle a feature flag
   */
  toggleFeatureFlag: superadminProcedure
    .input(toggleFeatureFlagSchema)
    .mutation(async ({ ctx, input }) => {
      return adminService.toggleFeatureFlag(
        ctx.user.id,
        input.key,
        input.enabled
      );
    }),

  /**
   * Create a new feature flag
   */
  createFeatureFlag: superadminProcedure
    .input(createFeatureFlagSchema)
    .mutation(async ({ ctx, input }) => {
      return adminService.createFeatureFlag(ctx.user.id, input);
    }),

  // ========== USER QUOTAS ==========

  /**
   * Get user quotas and current usage
   */
  getUserQuotas: superadminProcedure
    .input(z.string().uuid())
    .query(async ({ input: userId }) => {
      const [quotas, usage] = await Promise.all([
        agentSafetyService.getQuotas(userId),
        agentSafetyService.getTodayUsage(userId),
      ]);

      return {
        quotas: {
          dailyInvoiceLimit: quotas.dailyInvoiceLimit,
          dailyBillLimit: quotas.dailyBillLimit,
          dailyJournalEntryLimit: quotas.dailyJournalEntryLimit,
          dailyQuotationLimit: quotas.dailyQuotationLimit,
          dailyTokenLimit: quotas.dailyTokenLimit,
          maxSingleInvoiceAmount: quotas.maxSingleInvoiceAmount,
          maxSingleBillAmount: quotas.maxSingleBillAmount,
          maxSingleJournalAmount: quotas.maxSingleJournalAmount,
          maxDailyTotalAmount: quotas.maxDailyTotalAmount,
          maxActionsPerMinute: quotas.maxActionsPerMinute,
          maxConcurrentWorkflows: quotas.maxConcurrentWorkflows,
          emergencyStopEnabled: quotas.emergencyStopEnabled,
          emergencyStopReason: quotas.emergencyStopReason,
          emergencyStoppedAt: quotas.emergencyStoppedAt,
        },
        usage: {
          invoicesCreated: usage.invoicesCreated,
          billsCreated: usage.billsCreated,
          journalEntriesCreated: usage.journalEntriesCreated,
          quotationsCreated: usage.quotationsCreated,
          totalActions: usage.totalActions,
          tokensUsed: usage.tokensUsed,
          totalAmountProcessed: usage.totalAmountProcessed,
        },
      };
    }),

  /**
   * Update user quotas
   */
  updateUserQuotas: superadminProcedure
    .input(updateUserQuotasSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId, ...updates } = input;

      // Ensure quotas exist first
      await agentSafetyService.getQuotas(userId);

      // Update quotas
      const updatedQuotas = await agentSafetyService.updateQuotas(
        userId,
        updates
      );

      // Log the action
      await adminAuditService.logAction({
        adminId: ctx.user.id,
        action: "quota_override_set",
        description: "Updated user quota limits",
        targetType: "user",
        targetId: userId,
        newState: updates,
      });

      // Invalidate user's cached sessions so changes take effect immediately
      await invalidateUserSessions(userId);

      return updatedQuotas;
    }),

  /**
   * Reset daily usage counters for a user
   */
  resetUserDailyUsage: superadminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await agentSafetyService.resetDailyUsage(input.userId);

      // Log the action (using quota_override_set for daily usage reset)
      await adminAuditService.logAction({
        adminId: ctx.user.id,
        action: "quota_override_set",
        description: "Reset user daily usage counters to zero",
        targetType: "user",
        targetId: input.userId,
        newState: { usageReset: true, resetDate: result.date },
      });

      // Invalidate user's cached sessions
      await invalidateUserSessions(input.userId);

      return result;
    }),

  /**
   * Enable emergency stop for a user
   */
  enableEmergencyStop: superadminProcedure
    .input(emergencyStopSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await agentSafetyService.enableEmergencyStop(
        input.userId,
        ctx.user.id,
        input.reason
      );

      // Log the action
      await adminAuditService.logAction({
        adminId: ctx.user.id,
        action: "quota_override_set",
        description: input.reason ?? "Emergency stop enabled",
        targetType: "user",
        targetId: input.userId,
        newState: { emergencyStopEnabled: true },
      });

      // Invalidate user's cached sessions so emergency stop takes effect immediately
      await invalidateUserSessions(input.userId);

      return result;
    }),

  /**
   * Disable emergency stop for a user
   */
  disableEmergencyStop: superadminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await agentSafetyService.disableEmergencyStop(
        input.userId
      );

      // Log the action
      await adminAuditService.logAction({
        adminId: ctx.user.id,
        action: "quota_override_removed",
        description: "Emergency stop disabled",
        targetType: "user",
        targetId: input.userId,
        newState: { emergencyStopEnabled: false },
      });

      // Invalidate user's cached sessions so change takes effect immediately
      await invalidateUserSessions(input.userId);

      return result;
    }),
});

export type AdminRouter = typeof adminRouter;
