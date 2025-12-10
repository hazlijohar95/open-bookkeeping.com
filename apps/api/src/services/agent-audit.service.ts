import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import { agentAuditLogs } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import type { AgentActionType } from "./approval.service";

const logger = createLogger("agent-audit-service");

// Types
export interface AuditLogInput {
  userId: string;
  sessionId?: string;
  workflowId?: string;
  action: AgentActionType;
  resourceType: string;
  resourceId?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reasoning?: string;
  confidence?: number;
  approvedBy?: string;
  approvalType?: "auto" | "manual" | "threshold";
  approvalId?: string;
  isReversible?: "yes" | "no" | "partial";
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
  errorDetails?: {
    code?: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
  financialImpact?: {
    amount?: number;
    currency?: string;
    direction?: "increase" | "decrease" | "neutral";
    accountsAffected?: string[];
  };
}

export interface AuditLogQueryOptions {
  sessionId?: string;
  workflowId?: string;
  action?: AgentActionType;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export const agentAuditService = {
  /**
   * Log an agent action
   */
  logAction: async (input: AuditLogInput) => {
    try {
      const [log] = await db
        .insert(agentAuditLogs)
        .values({
          userId: input.userId,
          sessionId: input.sessionId || null,
          workflowId: input.workflowId || null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId || null,
          previousState: input.previousState || null,
          newState: input.newState || null,
          reasoning: input.reasoning || null,
          confidence: input.confidence !== undefined ? String(input.confidence) : null,
          approvedBy: input.approvedBy || null,
          approvalType: input.approvalType || null,
          approvalId: input.approvalId || null,
          isReversible: input.isReversible || "yes",
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
          success: input.success !== false ? "yes" : "no",
          errorMessage: input.errorMessage || null,
          errorDetails: input.errorDetails || null,
          financialImpact: input.financialImpact || null,
        })
        .returning();

      logger.debug(
        {
          auditId: log!.id,
          action: input.action,
          resourceType: input.resourceType,
        },
        "Agent action logged"
      );

      return log!;
    } catch (error) {
      logger.error({ error, input }, "Failed to log agent action");
      throw error;
    }
  },

  /**
   * Get audit trail for a specific resource
   */
  getAuditTrail: async (
    userId: string,
    resourceType: string,
    resourceId: string
  ) => {
    return db.query.agentAuditLogs.findMany({
      where: and(
        eq(agentAuditLogs.userId, userId),
        eq(agentAuditLogs.resourceType, resourceType),
        eq(agentAuditLogs.resourceId, resourceId)
      ),
      orderBy: [desc(agentAuditLogs.createdAt)],
    });
  },

  /**
   * Get audit logs with filters
   */
  getAuditLogs: async (userId: string, options?: AuditLogQueryOptions) => {
    const {
      sessionId,
      workflowId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      success,
      limit = 50,
      offset = 0,
    } = options || {};

    const conditions = [eq(agentAuditLogs.userId, userId)];

    if (sessionId) {
      conditions.push(eq(agentAuditLogs.sessionId, sessionId));
    }

    if (workflowId) {
      conditions.push(eq(agentAuditLogs.workflowId, workflowId));
    }

    if (action) {
      conditions.push(eq(agentAuditLogs.action, action));
    }

    if (resourceType) {
      conditions.push(eq(agentAuditLogs.resourceType, resourceType));
    }

    if (resourceId) {
      conditions.push(eq(agentAuditLogs.resourceId, resourceId));
    }

    if (startDate) {
      conditions.push(gte(agentAuditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(agentAuditLogs.createdAt, new Date(endDate)));
    }

    if (success !== undefined) {
      conditions.push(eq(agentAuditLogs.success, success ? "yes" : "no"));
    }

    return db.query.agentAuditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(agentAuditLogs.createdAt)],
      limit,
      offset,
    });
  },

  /**
   * Get audit log by ID
   */
  getById: async (auditLogId: string, userId: string) => {
    return db.query.agentAuditLogs.findFirst({
      where: and(
        eq(agentAuditLogs.id, auditLogId),
        eq(agentAuditLogs.userId, userId)
      ),
    });
  },

  /**
   * Mark an action as reversed
   */
  markReversed: async (
    auditLogId: string,
    userId: string,
    reversalAuditId: string
  ) => {
    const [updated] = await db
      .update(agentAuditLogs)
      .set({
        reversedAt: new Date(),
        reversedBy: userId,
        reversalAuditId,
      })
      .where(
        and(
          eq(agentAuditLogs.id, auditLogId),
          eq(agentAuditLogs.userId, userId)
        )
      )
      .returning();

    return updated;
  },

  /**
   * Check if an action can be undone
   */
  canUndo: async (auditLogId: string, userId: string): Promise<boolean> => {
    const log = await agentAuditService.getById(auditLogId, userId);

    if (!log) {
      return false;
    }

    // Already reversed
    if (log.reversedAt) {
      return false;
    }

    // Check if marked as reversible
    if (log.isReversible === "no") {
      return false;
    }

    // Check success status
    if (log.success !== "yes") {
      return false;
    }

    return true;
  },

  /**
   * Get summary statistics for audit logs
   */
  getStats: async (
    userId: string,
    options?: { startDate?: string; endDate?: string }
  ) => {
    const { startDate, endDate } = options || {};

    const conditions = [eq(agentAuditLogs.userId, userId)];

    if (startDate) {
      conditions.push(gte(agentAuditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(agentAuditLogs.createdAt, new Date(endDate)));
    }

    const logs = await db.query.agentAuditLogs.findMany({
      where: and(...conditions),
      columns: {
        action: true,
        success: true,
        financialImpact: true,
      },
    });

    const stats = {
      totalActions: logs.length,
      successfulActions: logs.filter((l) => l.success === "yes").length,
      failedActions: logs.filter((l) => l.success === "no").length,
      actionsByType: {} as Record<string, number>,
      totalFinancialImpact: 0,
    };

    for (const log of logs) {
      // Count by action type
      stats.actionsByType[log.action] =
        (stats.actionsByType[log.action] || 0) + 1;

      // Sum financial impact
      const impact = log.financialImpact as { amount?: number } | null;
      if (impact?.amount) {
        stats.totalFinancialImpact += impact.amount;
      }
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
    const { startDate, endDate, format = "json" } = options || {};

    const logs = await agentAuditService.getAuditLogs(userId, {
      startDate,
      endDate,
      limit: 10000, // High limit for export
    });

    if (format === "csv") {
      // Generate CSV
      const headers = [
        "ID",
        "Timestamp",
        "Action",
        "Resource Type",
        "Resource ID",
        "Success",
        "Reasoning",
        "Confidence",
        "Approval Type",
        "Financial Impact",
      ];

      const rows = logs.map((log) => [
        log.id,
        log.createdAt.toISOString(),
        log.action,
        log.resourceType,
        log.resourceId || "",
        log.success,
        log.reasoning || "",
        log.confidence || "",
        log.approvalType || "",
        JSON.stringify(log.financialImpact || {}),
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
        "\n"
      );

      return { format: "csv", data: csv };
    }

    return { format: "json", data: logs };
  },
};
