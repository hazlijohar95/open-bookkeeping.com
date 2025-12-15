/**
 * User Audit Service
 * Tracks important user actions for security, compliance, and debugging
 * Separate from agent audit service which tracks AI agent actions
 */

import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import { userAuditLogs } from "@open-bookkeeping/db";
import type { UserActionType } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("user-audit-service");

// Category mapping for actions
const ACTION_CATEGORIES: Record<UserActionType, string> = {
  // Authentication
  login: "auth",
  logout: "auth",
  password_change: "auth",
  password_reset: "auth",
  session_refresh: "auth",
  mfa_enabled: "auth",
  mfa_disabled: "auth",
  // Settings
  settings_view: "settings",
  settings_update: "settings",
  profile_update: "settings",
  company_update: "settings",
  notification_update: "settings",
  agent_settings_update: "settings",
  // Export
  export_invoices: "export",
  export_customers: "export",
  export_vendors: "export",
  export_bills: "export",
  export_reports: "export",
  export_audit_logs: "export",
  // API Key
  api_key_created: "api_key",
  api_key_revoked: "api_key",
  api_key_viewed: "api_key",
  // Webhook
  webhook_created: "webhook",
  webhook_updated: "webhook",
  webhook_deleted: "webhook",
  // Admin/Dangerous
  bulk_delete: "admin",
  data_import: "admin",
  account_deletion_request: "admin",
  // Security
  suspicious_activity: "security",
  rate_limit_exceeded: "security",
  invalid_access_attempt: "security",
};

// Risk level mapping for actions
const ACTION_RISK_LEVELS: Record<UserActionType, "low" | "medium" | "high" | "critical"> = {
  // Low risk - normal operations
  login: "low",
  logout: "low",
  session_refresh: "low",
  settings_view: "low",
  // Medium risk - changes that can be reverted
  settings_update: "medium",
  profile_update: "medium",
  company_update: "medium",
  notification_update: "medium",
  agent_settings_update: "medium",
  export_invoices: "medium",
  export_customers: "medium",
  export_vendors: "medium",
  export_bills: "medium",
  export_reports: "medium",
  export_audit_logs: "medium",
  webhook_updated: "medium",
  // High risk - security-related changes
  password_change: "high",
  password_reset: "high",
  mfa_enabled: "high",
  mfa_disabled: "high",
  api_key_created: "high",
  api_key_revoked: "high",
  api_key_viewed: "high",
  webhook_created: "high",
  webhook_deleted: "high",
  data_import: "high",
  // Critical risk - security events and destructive actions
  bulk_delete: "critical",
  account_deletion_request: "critical",
  suspicious_activity: "critical",
  rate_limit_exceeded: "critical",
  invalid_access_attempt: "critical",
};

// Types
export interface UserAuditLogInput {
  userId: string;
  action: UserActionType;
  description?: string;
  resourceType?: string;
  resourceId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  sessionId?: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
    isMobile?: boolean;
  };
  success?: boolean;
  errorMessage?: string;
  errorCode?: string;
  riskFactors?: string[];
  metadata?: Record<string, unknown>;
}

export interface UserAuditLogQueryOptions {
  action?: UserActionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  riskLevel?: "low" | "medium" | "high" | "critical";
  ipAddress?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

export const userAuditService = {
  /**
   * Log a user action
   */
  logAction: async (input: UserAuditLogInput) => {
    try {
      const category = ACTION_CATEGORIES[input.action];
      const defaultRiskLevel = ACTION_RISK_LEVELS[input.action];

      // Calculate risk level based on factors
      let riskLevel = defaultRiskLevel;
      const riskFactors = input.riskFactors ?? [];

      // Elevate risk if there are risk factors
      if (riskFactors.length > 0) {
        if (riskLevel === "low") riskLevel = "medium";
        else if (riskLevel === "medium") riskLevel = "high";
      }

      const [log] = await db
        .insert(userAuditLogs)
        .values({
          userId: input.userId,
          action: input.action,
          category,
          description: input.description ?? null,
          resourceType: input.resourceType ?? null,
          resourceId: input.resourceId ?? null,
          previousState: input.previousState ?? null,
          newState: input.newState ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          requestId: input.requestId ?? null,
          geoLocation: input.geoLocation ?? null,
          sessionId: input.sessionId ?? null,
          deviceInfo: input.deviceInfo ?? null,
          success: input.success !== false ? "yes" : "no",
          errorMessage: input.errorMessage ?? null,
          errorCode: input.errorCode ?? null,
          riskLevel,
          riskFactors: riskFactors.length > 0 ? riskFactors : null,
          metadata: input.metadata ?? null,
        })
        .returning();

      logger.debug(
        {
          auditId: log!.id,
          action: input.action,
          category,
          riskLevel,
        },
        "User action logged"
      );

      return log!;
    } catch (error) {
      logger.error({ error, input }, "Failed to log user action");
      // Don't throw - audit logging should not break the main flow
      return null;
    }
  },

  /**
   * Get audit logs with filters
   */
  getAuditLogs: async (userId: string, options?: UserAuditLogQueryOptions) => {
    const {
      action,
      category,
      startDate,
      endDate,
      success,
      riskLevel,
      ipAddress,
      sessionId,
      limit = 50,
      offset = 0,
    } = options ?? {};

    const conditions = [eq(userAuditLogs.userId, userId)];

    if (action) {
      conditions.push(eq(userAuditLogs.action, action));
    }

    if (category) {
      conditions.push(eq(userAuditLogs.category, category));
    }

    if (startDate) {
      conditions.push(gte(userAuditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(userAuditLogs.createdAt, new Date(endDate)));
    }

    if (success !== undefined) {
      conditions.push(eq(userAuditLogs.success, success ? "yes" : "no"));
    }

    if (riskLevel) {
      conditions.push(eq(userAuditLogs.riskLevel, riskLevel));
    }

    if (ipAddress) {
      conditions.push(eq(userAuditLogs.ipAddress, ipAddress));
    }

    if (sessionId) {
      conditions.push(eq(userAuditLogs.sessionId, sessionId));
    }

    return db.query.userAuditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(userAuditLogs.createdAt)],
      limit,
      offset,
    });
  },

  /**
   * Get recent security events for a user
   */
  getSecurityEvents: async (userId: string, days = 7) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return db.query.userAuditLogs.findMany({
      where: and(
        eq(userAuditLogs.userId, userId),
        eq(userAuditLogs.category, "security"),
        gte(userAuditLogs.createdAt, startDate)
      ),
      orderBy: [desc(userAuditLogs.createdAt)],
    });
  },

  /**
   * Get login history for a user
   */
  getLoginHistory: async (userId: string, limit = 10) => {
    return db.query.userAuditLogs.findMany({
      where: and(
        eq(userAuditLogs.userId, userId),
        eq(userAuditLogs.action, "login")
      ),
      orderBy: [desc(userAuditLogs.createdAt)],
      limit,
    });
  },

  /**
   * Get high-risk actions for a user
   */
  getHighRiskActions: async (userId: string, days = 30) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return db.query.userAuditLogs.findMany({
      where: and(
        eq(userAuditLogs.userId, userId),
        gte(userAuditLogs.createdAt, startDate),
        sql`${userAuditLogs.riskLevel} IN ('high', 'critical')`
      ),
      orderBy: [desc(userAuditLogs.createdAt)],
    });
  },

  /**
   * Check for suspicious activity patterns
   * Returns true if suspicious patterns detected
   */
  checkSuspiciousActivity: async (
    userId: string,
    ipAddress: string
  ): Promise<{ suspicious: boolean; reasons: string[] }> => {
    const reasons: string[] = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check for multiple failed login attempts in the last hour
    const failedLogins = await db.query.userAuditLogs.findMany({
      where: and(
        eq(userAuditLogs.userId, userId),
        eq(userAuditLogs.action, "login"),
        eq(userAuditLogs.success, "no"),
        gte(userAuditLogs.createdAt, oneHourAgo)
      ),
    });

    if (failedLogins.length >= 5) {
      reasons.push(`${failedLogins.length} failed login attempts in the last hour`);
    }

    // Check for logins from multiple IPs in the last day
    const recentLogins = await db.query.userAuditLogs.findMany({
      where: and(
        eq(userAuditLogs.userId, userId),
        eq(userAuditLogs.action, "login"),
        eq(userAuditLogs.success, "yes"),
        gte(userAuditLogs.createdAt, oneDayAgo)
      ),
    });

    const uniqueIps = new Set(recentLogins.map((l) => l.ipAddress).filter(Boolean));
    if (uniqueIps.size >= 5 && !uniqueIps.has(ipAddress)) {
      reasons.push(`Login from new IP (${uniqueIps.size} different IPs in 24h)`);
    }

    // Check for password changes from different IPs
    const passwordChanges = await db.query.userAuditLogs.findMany({
      where: and(
        eq(userAuditLogs.userId, userId),
        eq(userAuditLogs.action, "password_change"),
        gte(userAuditLogs.createdAt, oneDayAgo)
      ),
    });

    if (passwordChanges.length >= 2) {
      reasons.push(`${passwordChanges.length} password changes in 24 hours`);
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    };
  },

  /**
   * Get audit summary statistics
   */
  getStats: async (
    userId: string,
    options?: { startDate?: string; endDate?: string }
  ) => {
    const { startDate, endDate } = options ?? {};

    const conditions = [eq(userAuditLogs.userId, userId)];

    if (startDate) {
      conditions.push(gte(userAuditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(userAuditLogs.createdAt, new Date(endDate)));
    }

    const logs = await db.query.userAuditLogs.findMany({
      where: and(...conditions),
      columns: {
        action: true,
        category: true,
        success: true,
        riskLevel: true,
      },
    });

    const stats = {
      totalActions: logs.length,
      successfulActions: logs.filter((l) => l.success === "yes").length,
      failedActions: logs.filter((l) => l.success === "no").length,
      actionsByCategory: {} as Record<string, number>,
      actionsByRiskLevel: {} as Record<string, number>,
      topActions: {} as Record<string, number>,
    };

    for (const log of logs) {
      // Count by category
      stats.actionsByCategory[log.category] =
        (stats.actionsByCategory[log.category] ?? 0) + 1;

      // Count by risk level
      if (log.riskLevel) {
        stats.actionsByRiskLevel[log.riskLevel] =
          (stats.actionsByRiskLevel[log.riskLevel] ?? 0) + 1;
      }

      // Count by action type
      stats.topActions[log.action] = (stats.topActions[log.action] ?? 0) + 1;
    }

    return stats;
  },

  /**
   * Export audit logs for compliance
   */
  exportLogs: async (
    userId: string,
    options?: { startDate?: string; endDate?: string; format?: "json" | "csv" }
  ) => {
    const { startDate, endDate, format = "json" } = options ?? {};

    const logs = await userAuditService.getAuditLogs(userId, {
      startDate,
      endDate,
      limit: 10000, // High limit for export
    });

    // Log the export action
    await userAuditService.logAction({
      userId,
      action: "export_audit_logs",
      description: `Exported ${logs.length} audit log entries`,
      metadata: { startDate, endDate, format, count: logs.length },
    });

    if (format === "csv") {
      const headers = [
        "ID",
        "Timestamp",
        "Action",
        "Category",
        "Description",
        "Resource Type",
        "Resource ID",
        "Success",
        "Risk Level",
        "IP Address",
        "User Agent",
      ];

      const rows = logs.map((log) => [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.category,
        log.description ?? "",
        log.resourceType ?? "",
        log.resourceId ?? "",
        log.success,
        log.riskLevel ?? "",
        log.ipAddress ?? "",
        log.userAgent ?? "",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );

      return { format: "csv", data: csv };
    }

    return { format: "json", data: logs };
  },

  /**
   * Clean up old audit logs (retention policy)
   * Keep high-risk logs longer than low-risk ones
   */
  cleanupOldLogs: async (
    retentionDays: { low: number; medium: number; high: number; critical: number } = {
      low: 90,
      medium: 180,
      high: 365,
      critical: 730, // 2 years for critical
    }
  ) => {
    const now = new Date();
    let totalDeleted = 0;

    for (const [riskLevel, days] of Object.entries(retentionDays)) {
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(userAuditLogs)
        .where(
          and(
            eq(userAuditLogs.riskLevel, riskLevel),
            lte(userAuditLogs.createdAt, cutoffDate)
          )
        );

      const deletedCount = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      totalDeleted += deletedCount;

      if (deletedCount > 0) {
        logger.info(
          { riskLevel, cutoffDate, deletedCount },
          "Cleaned up old audit logs"
        );
      }
    }

    return { totalDeleted };
  },
};
