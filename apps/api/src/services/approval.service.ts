import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import {
  agentApprovalSettings,
  agentPendingApprovals,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("approval-service");

// Types for agent actions
export type AgentActionType =
  | "create_invoice"
  | "update_invoice"
  | "send_invoice"
  | "mark_invoice_paid"
  | "void_invoice"
  | "create_bill"
  | "update_bill"
  | "mark_bill_paid"
  | "schedule_bill_payment"
  | "create_journal_entry"
  | "reverse_journal_entry"
  | "create_quotation"
  | "update_quotation"
  | "send_quotation"
  | "convert_quotation"
  | "create_customer"
  | "update_customer"
  | "create_vendor"
  | "update_vendor"
  | "match_transaction"
  | "create_matching_entry"
  | "read_data"
  | "analyze_data";

export interface AgentAction {
  type: AgentActionType;
  payload: Record<string, unknown>;
  estimatedAmount?: number;
  currency?: string;
  resourceType?: string;
  reasoning?: string;
  confidence?: number;
}

export interface ApprovalCheckResult {
  requiresApproval: boolean;
  reason?: string;
  threshold?: number;
}

export interface PendingApprovalInput {
  userId: string;
  actionType: AgentActionType;
  actionPayload: Record<string, unknown>;
  sessionId?: string;
  reasoning?: string;
  confidence?: number;
  estimatedImpact?: {
    amount?: number;
    currency?: string;
    resourceType?: string;
    accountsAffected?: string[];
    description?: string;
  };
  previewData?: Record<string, unknown>;
}

// Read-only actions that typically don't need approval
const READ_ONLY_ACTIONS: AgentActionType[] = [
  "read_data",
  "analyze_data",
];

// Default approval timeout in hours
const DEFAULT_APPROVAL_TIMEOUT_HOURS = 24;

export const approvalService = {
  /**
   * Get or create approval settings for a user
   */
  getSettings: async (userId: string) => {
    let settings = await db.query.agentApprovalSettings.findFirst({
      where: eq(agentApprovalSettings.userId, userId),
    });

    if (!settings) {
      // Create default settings
      const [created] = await db
        .insert(agentApprovalSettings)
        .values({
          userId,
          requireApproval: false, // Full autonomy by default
          autoApproveReadOnly: true,
          autoApproveRecurring: false,
          notifyOnApprovalRequired: true,
          notifyOnAutoApproved: false,
          approvalTimeoutHours: String(DEFAULT_APPROVAL_TIMEOUT_HOURS),
        })
        .returning();

      settings = created!;
    }

    return settings;
  },

  /**
   * Update approval settings
   */
  updateSettings: async (
    userId: string,
    updates: {
      requireApproval?: boolean;
      invoiceThreshold?: string | null;
      billThreshold?: string | null;
      journalEntryThreshold?: string | null;
      autoApproveReadOnly?: boolean;
      autoApproveRecurring?: boolean;
      allowedActions?: string[] | null;
      blockedActions?: string[] | null;
      notifyOnApprovalRequired?: boolean;
      notifyOnAutoApproved?: boolean;
      approvalTimeoutHours?: string;
    }
  ) => {
    const [updated] = await db
      .update(agentApprovalSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agentApprovalSettings.userId, userId))
      .returning();

    return updated;
  },

  /**
   * Check if an action requires approval based on user settings
   */
  checkRequiresApproval: async (
    userId: string,
    action: AgentAction
  ): Promise<ApprovalCheckResult> => {
    const settings = await approvalService.getSettings(userId);

    // If approval is not required globally, auto-approve everything
    if (!settings.requireApproval) {
      return { requiresApproval: false, reason: "Approval not required (full autonomy mode)" };
    }

    // Check if action is read-only and auto-approve is enabled
    if (READ_ONLY_ACTIONS.includes(action.type) && settings.autoApproveReadOnly) {
      return { requiresApproval: false, reason: "Read-only action auto-approved" };
    }

    // Check blocked actions list
    const blockedActions = settings.blockedActions as string[] | null;
    if (blockedActions?.includes(action.type)) {
      return { requiresApproval: true, reason: "Action is in blocked list" };
    }

    // Check allowed actions list (if set, only these are auto-approved)
    const allowedActions = settings.allowedActions as string[] | null;
    if (allowedActions && allowedActions.length > 0) {
      if (!allowedActions.includes(action.type)) {
        return { requiresApproval: true, reason: "Action not in allowed list" };
      }
    }

    // Check amount thresholds
    if (action.estimatedAmount !== undefined) {
      let threshold: number | null = null;
      let thresholdType = "";

      if (action.type.includes("invoice") && settings.invoiceThreshold) {
        threshold = parseFloat(settings.invoiceThreshold);
        thresholdType = "invoice";
      } else if (action.type.includes("bill") && settings.billThreshold) {
        threshold = parseFloat(settings.billThreshold);
        thresholdType = "bill";
      } else if (
        action.type.includes("journal") &&
        settings.journalEntryThreshold
      ) {
        threshold = parseFloat(settings.journalEntryThreshold);
        thresholdType = "journal entry";
      }

      if (threshold !== null && action.estimatedAmount > threshold) {
        return {
          requiresApproval: true,
          reason: `Amount exceeds ${thresholdType} threshold`,
          threshold,
        };
      }
    }

    // Default: require approval when settings.requireApproval is true
    return { requiresApproval: true, reason: "Global approval required" };
  },

  /**
   * Create a pending approval request
   */
  createApprovalRequest: async (input: PendingApprovalInput) => {
    const settings = await approvalService.getSettings(input.userId);
    const timeoutHours = parseFloat(settings.approvalTimeoutHours || String(DEFAULT_APPROVAL_TIMEOUT_HOURS));
    const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);

    const [approval] = await db
      .insert(agentPendingApprovals)
      .values({
        userId: input.userId,
        actionType: input.actionType,
        actionPayload: input.actionPayload,
        sessionId: input.sessionId ?? null,
        reasoning: input.reasoning ?? null,
        confidence: input.confidence !== undefined ? String(input.confidence) : null,
        status: "pending",
        estimatedImpact: input.estimatedImpact ?? null,
        previewData: input.previewData ?? null,
        expiresAt,
      })
      .returning();

    logger.info(
      { approvalId: approval!.id, actionType: input.actionType },
      "Approval request created"
    );

    return approval!;
  },

  /**
   * Get pending approvals for a user
   */
  getPendingApprovals: async (userId: string, limit = 50) => {
    return db.query.agentPendingApprovals.findMany({
      where: and(
        eq(agentPendingApprovals.userId, userId),
        eq(agentPendingApprovals.status, "pending"),
        sql`${agentPendingApprovals.expiresAt} > NOW()`
      ),
      orderBy: [desc(agentPendingApprovals.createdAt)],
      limit,
    });
  },

  /**
   * Approve a pending action
   */
  approveAction: async (
    approvalId: string,
    userId: string,
    notes?: string
  ) => {
    const approval = await db.query.agentPendingApprovals.findFirst({
      where: and(
        eq(agentPendingApprovals.id, approvalId),
        eq(agentPendingApprovals.userId, userId)
      ),
    });

    if (!approval) {
      throw new Error("Approval request not found");
    }

    if (approval.status !== "pending") {
      throw new Error(`Approval is already ${approval.status}`);
    }

    if (new Date(approval.expiresAt) < new Date()) {
      // Mark as expired
      await db
        .update(agentPendingApprovals)
        .set({ status: "expired" })
        .where(eq(agentPendingApprovals.id, approvalId));

      throw new Error("Approval request has expired");
    }

    const [updated] = await db
      .update(agentPendingApprovals)
      .set({
        status: "approved",
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      })
      .where(eq(agentPendingApprovals.id, approvalId))
      .returning();

    logger.info({ approvalId }, "Action approved");

    return updated!;
  },

  /**
   * Reject a pending action
   */
  rejectAction: async (
    approvalId: string,
    userId: string,
    notes?: string
  ) => {
    const approval = await db.query.agentPendingApprovals.findFirst({
      where: and(
        eq(agentPendingApprovals.id, approvalId),
        eq(agentPendingApprovals.userId, userId)
      ),
    });

    if (!approval) {
      throw new Error("Approval request not found");
    }

    if (approval.status !== "pending") {
      throw new Error(`Approval is already ${approval.status}`);
    }

    const [updated] = await db
      .update(agentPendingApprovals)
      .set({
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      })
      .where(eq(agentPendingApprovals.id, approvalId))
      .returning();

    logger.info({ approvalId }, "Action rejected");

    return updated!;
  },

  /**
   * Get approval by ID
   */
  getApprovalById: async (approvalId: string, userId: string) => {
    return db.query.agentPendingApprovals.findFirst({
      where: and(
        eq(agentPendingApprovals.id, approvalId),
        eq(agentPendingApprovals.userId, userId)
      ),
    });
  },

  /**
   * Get approval history
   */
  getApprovalHistory: async (
    userId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ) => {
    const { status, limit = 50, offset = 0 } = options ?? {};

    const conditions = [eq(agentPendingApprovals.userId, userId)];

    if (status) {
      conditions.push(
        sql`${agentPendingApprovals.status} = ${status}`
      );
    }

    return db.query.agentPendingApprovals.findMany({
      where: and(...conditions),
      orderBy: [desc(agentPendingApprovals.createdAt)],
      limit,
      offset,
    });
  },

  /**
   * Expire old pending approvals (should be called periodically)
   */
  expireOldApprovals: async () => {
    const result = await db
      .update(agentPendingApprovals)
      .set({ status: "expired" })
      .where(
        and(
          eq(agentPendingApprovals.status, "pending"),
          sql`${agentPendingApprovals.expiresAt} < NOW()`
        )
      )
      .returning({ id: agentPendingApprovals.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Expired old approval requests");
    }

    return result.length;
  },
};
