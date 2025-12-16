/**
 * Admin Audit Service
 * Tracks all superadmin actions for security, compliance, and accountability
 */

import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db, adminAuditLogs } from "@open-bookkeeping/db";
import type { AdminActionType } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("admin-audit-service");

// ============================================
// TYPES
// ============================================

export interface AdminAuditLogInput {
  adminId: string;
  action: AdminActionType;
  description?: string;
  targetType?: "user" | "organization" | "system" | "feature_flag";
  targetId?: string;
  targetEmail?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminAuditLogQueryOptions {
  action?: AdminActionType;
  targetType?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// SERVICE
// ============================================

export const adminAuditService = {
  /**
   * Log an admin action
   */
  async logAction(input: AdminAuditLogInput) {
    try {
      const [log] = await db
        .insert(adminAuditLogs)
        .values({
          adminId: input.adminId,
          action: input.action,
          description: input.description,
          targetType: input.targetType,
          targetId: input.targetId,
          targetEmail: input.targetEmail,
          previousState: input.previousState,
          newState: input.newState,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          metadata: input.metadata,
        })
        .returning();

      logger.debug({ auditId: log!.id, action: input.action }, "Admin action logged");
      return log!;
    } catch (error) {
      logger.error({ error, input }, "Failed to log admin action");
      // Don't throw - logging failures shouldn't break the operation
      return null;
    }
  },

  /**
   * Get admin audit logs with filtering
   */
  async getLogs(options: AdminAuditLogQueryOptions = {}) {
    const { limit = 50, offset = 0 } = options;

    const conditions = [];

    if (options.action) {
      conditions.push(eq(adminAuditLogs.action, options.action));
    }

    if (options.targetType) {
      conditions.push(eq(adminAuditLogs.targetType, options.targetType));
    }

    if (options.targetId) {
      conditions.push(eq(adminAuditLogs.targetId, options.targetId));
    }

    if (options.startDate) {
      conditions.push(gte(adminAuditLogs.createdAt, new Date(options.startDate)));
    }

    if (options.endDate) {
      conditions.push(lte(adminAuditLogs.createdAt, new Date(options.endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db.query.adminAuditLogs.findMany({
        where: whereClause,
        orderBy: [desc(adminAuditLogs.createdAt)],
        limit,
        offset,
        with: {
          admin: {
            columns: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(adminAuditLogs)
        .where(whereClause),
    ]);

    return {
      logs,
      total: Number(countResult[0]?.count ?? 0),
      limit,
      offset,
    };
  },

  /**
   * Get a single audit log by ID
   */
  async getLogById(id: string) {
    return db.query.adminAuditLogs.findFirst({
      where: eq(adminAuditLogs.id, id),
      with: {
        admin: {
          columns: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  },

  /**
   * Get logs for a specific target (user, org, etc.)
   */
  async getLogsForTarget(targetType: string, targetId: string, limit = 50) {
    return db.query.adminAuditLogs.findMany({
      where: and(
        eq(adminAuditLogs.targetType, targetType),
        eq(adminAuditLogs.targetId, targetId)
      ),
      orderBy: [desc(adminAuditLogs.createdAt)],
      limit,
      with: {
        admin: {
          columns: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  },

  /**
   * Get action statistics for dashboard
   */
  async getStats(startDate?: string, endDate?: string) {
    const conditions = [];

    if (startDate) {
      conditions.push(gte(adminAuditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(adminAuditLogs.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const stats = await db
      .select({
        action: adminAuditLogs.action,
        count: sql<number>`count(*)`,
      })
      .from(adminAuditLogs)
      .where(whereClause)
      .groupBy(adminAuditLogs.action);

    return stats.reduce(
      (acc, row) => {
        acc[row.action] = Number(row.count);
        return acc;
      },
      {} as Record<string, number>
    );
  },
};

export type AdminAuditService = typeof adminAuditService;
