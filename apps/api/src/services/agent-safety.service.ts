import { eq, and, sql } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import { agentQuotas, agentUsage } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import type { AgentActionType } from "./approval.service";

const logger = createLogger("agent-safety-service");

// Types
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  remaining?: number;
}

export interface UsageUpdate {
  action: AgentActionType;
  amount?: number;
  currency?: string;
  tokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

// Default quotas
const DEFAULT_QUOTAS = {
  dailyInvoiceLimit: 100,
  dailyBillLimit: 100,
  dailyJournalEntryLimit: 200,
  dailyQuotationLimit: 100,
  dailyTokenLimit: 1000000,
  maxSingleInvoiceAmount: null as string | null,
  maxSingleBillAmount: null as string | null,
  maxSingleJournalAmount: null as string | null,
  maxDailyTotalAmount: null as string | null,
  maxActionsPerMinute: 30,
  maxConcurrentWorkflows: 5,
};

export const agentSafetyService = {
  /**
   * Get or create quota settings for a user
   */
  getQuotas: async (userId: string) => {
    let quotas = await db.query.agentQuotas.findFirst({
      where: eq(agentQuotas.userId, userId),
    });

    if (!quotas) {
      const [created] = await db
        .insert(agentQuotas)
        .values({
          userId,
          ...DEFAULT_QUOTAS,
          emergencyStopEnabled: false,
        })
        .returning();

      quotas = created!;
    }

    return quotas;
  },

  /**
   * Update quota settings
   */
  updateQuotas: async (
    userId: string,
    updates: Partial<typeof DEFAULT_QUOTAS>
  ) => {
    const [updated] = await db
      .update(agentQuotas)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agentQuotas.userId, userId))
      .returning();

    return updated;
  },

  /**
   * Get today's usage for a user
   */
  getTodayUsage: async (userId: string) => {
    const today = new Date().toISOString().split("T")[0]!;

    let usage = await db.query.agentUsage.findFirst({
      where: and(
        eq(agentUsage.userId, userId),
        eq(agentUsage.date, today)
      ),
    });

    if (!usage) {
      const [created] = await db
        .insert(agentUsage)
        .values({
          userId,
          date: today,
          invoicesCreated: 0,
          billsCreated: 0,
          journalEntriesCreated: 0,
          quotationsCreated: 0,
          totalActions: 0,
          totalMutations: 0,
          totalReads: 0,
          totalAmountProcessed: "0",
          tokensUsed: 0,
          promptTokensUsed: 0,
          completionTokensUsed: 0,
          workflowsStarted: 0,
          workflowsCompleted: 0,
          workflowsFailed: 0,
          approvalsRequested: 0,
          approvalsGranted: 0,
          approvalsRejected: 0,
        })
        .returning();

      usage = created!;
    }

    return usage;
  },

  /**
   * Check if an action is allowed based on quotas
   */
  checkQuota: async (
    userId: string,
    action: AgentActionType,
    amount?: number
  ): Promise<QuotaCheckResult> => {
    const quotas = await agentSafetyService.getQuotas(userId);
    const usage = await agentSafetyService.getTodayUsage(userId);

    // Check emergency stop
    if (quotas.emergencyStopEnabled) {
      return {
        allowed: false,
        reason: "Emergency stop is enabled. AI agent actions are blocked.",
      };
    }

    // Check action-specific limits
    if (action === "create_invoice") {
      if (usage.invoicesCreated >= quotas.dailyInvoiceLimit) {
        return {
          allowed: false,
          reason: "Daily invoice creation limit reached",
          limit: quotas.dailyInvoiceLimit,
          current: usage.invoicesCreated,
          remaining: 0,
        };
      }

      // Check single invoice amount limit
      if (
        amount !== undefined &&
        quotas.maxSingleInvoiceAmount !== null &&
        amount > parseFloat(quotas.maxSingleInvoiceAmount)
      ) {
        return {
          allowed: false,
          reason: `Invoice amount exceeds maximum allowed (${quotas.maxSingleInvoiceAmount})`,
          limit: parseFloat(quotas.maxSingleInvoiceAmount),
        };
      }
    }

    if (action === "create_bill") {
      if (usage.billsCreated >= quotas.dailyBillLimit) {
        return {
          allowed: false,
          reason: "Daily bill creation limit reached",
          limit: quotas.dailyBillLimit,
          current: usage.billsCreated,
          remaining: 0,
        };
      }

      if (
        amount !== undefined &&
        quotas.maxSingleBillAmount !== null &&
        amount > parseFloat(quotas.maxSingleBillAmount)
      ) {
        return {
          allowed: false,
          reason: `Bill amount exceeds maximum allowed (${quotas.maxSingleBillAmount})`,
          limit: parseFloat(quotas.maxSingleBillAmount),
        };
      }
    }

    if (action === "create_journal_entry") {
      if (usage.journalEntriesCreated >= quotas.dailyJournalEntryLimit) {
        return {
          allowed: false,
          reason: "Daily journal entry creation limit reached",
          limit: quotas.dailyJournalEntryLimit,
          current: usage.journalEntriesCreated,
          remaining: 0,
        };
      }

      if (
        amount !== undefined &&
        quotas.maxSingleJournalAmount !== null &&
        amount > parseFloat(quotas.maxSingleJournalAmount)
      ) {
        return {
          allowed: false,
          reason: `Journal entry amount exceeds maximum allowed (${quotas.maxSingleJournalAmount})`,
          limit: parseFloat(quotas.maxSingleJournalAmount),
        };
      }
    }

    if (action === "create_quotation") {
      if (usage.quotationsCreated >= quotas.dailyQuotationLimit) {
        return {
          allowed: false,
          reason: "Daily quotation creation limit reached",
          limit: quotas.dailyQuotationLimit,
          current: usage.quotationsCreated,
          remaining: 0,
        };
      }
    }

    // Check daily total amount limit
    if (
      amount !== undefined &&
      quotas.maxDailyTotalAmount !== null
    ) {
      const currentTotal = parseFloat(usage.totalAmountProcessed ?? "0");
      const maxTotal = parseFloat(quotas.maxDailyTotalAmount);

      if (currentTotal + amount > maxTotal) {
        return {
          allowed: false,
          reason: `Daily total amount limit would be exceeded`,
          limit: maxTotal,
          current: currentTotal,
          remaining: maxTotal - currentTotal,
        };
      }
    }

    // Check token limit
    if (usage.tokensUsed >= quotas.dailyTokenLimit) {
      return {
        allowed: false,
        reason: "Daily token limit reached",
        limit: quotas.dailyTokenLimit,
        current: usage.tokensUsed,
        remaining: 0,
      };
    }

    return { allowed: true };
  },

  /**
   * Record usage after an action
   */
  recordUsage: async (userId: string, update: UsageUpdate) => {
    const today = new Date().toISOString().split("T")[0]!;
    await agentSafetyService.getTodayUsage(userId); // Ensure record exists

    const updates: Record<string, unknown> = {
      totalActions: sql`${agentUsage.totalActions} + 1`,
      updatedAt: new Date(),
    };

    // Action-specific counters
    if (update.action === "create_invoice") {
      updates.invoicesCreated = sql`${agentUsage.invoicesCreated} + 1`;
      updates.totalMutations = sql`${agentUsage.totalMutations} + 1`;
    } else if (update.action === "create_bill") {
      updates.billsCreated = sql`${agentUsage.billsCreated} + 1`;
      updates.totalMutations = sql`${agentUsage.totalMutations} + 1`;
    } else if (update.action === "create_journal_entry") {
      updates.journalEntriesCreated = sql`${agentUsage.journalEntriesCreated} + 1`;
      updates.totalMutations = sql`${agentUsage.totalMutations} + 1`;
    } else if (update.action === "create_quotation") {
      updates.quotationsCreated = sql`${agentUsage.quotationsCreated} + 1`;
      updates.totalMutations = sql`${agentUsage.totalMutations} + 1`;
    } else if (
      update.action === "read_data" ||
      update.action === "analyze_data"
    ) {
      updates.totalReads = sql`${agentUsage.totalReads} + 1`;
    } else {
      // Other mutations
      updates.totalMutations = sql`${agentUsage.totalMutations} + 1`;
    }

    // Amount processed
    if (update.amount !== undefined) {
      updates.totalAmountProcessed = sql`${agentUsage.totalAmountProcessed} + ${update.amount}`;
    }

    // Token usage
    if (update.tokens !== undefined) {
      updates.tokensUsed = sql`${agentUsage.tokensUsed} + ${update.tokens}`;
    }
    if (update.promptTokens !== undefined) {
      updates.promptTokensUsed = sql`${agentUsage.promptTokensUsed} + ${update.promptTokens}`;
    }
    if (update.completionTokens !== undefined) {
      updates.completionTokensUsed = sql`${agentUsage.completionTokensUsed} + ${update.completionTokens}`;
    }

    await db
      .update(agentUsage)
      .set(updates)
      .where(
        and(eq(agentUsage.userId, userId), eq(agentUsage.date, today))
      );

    logger.debug({ userId, action: update.action }, "Usage recorded");
  },

  /**
   * Enable emergency stop
   */
  enableEmergencyStop: async (
    userId: string,
    stoppedBy: string,
    reason?: string
  ) => {
    const [updated] = await db
      .update(agentQuotas)
      .set({
        emergencyStopEnabled: true,
        emergencyStoppedAt: new Date(),
        emergencyStoppedBy: stoppedBy,
        updatedAt: new Date(),
      })
      .where(eq(agentQuotas.userId, userId))
      .returning();

    logger.warn({ userId, stoppedBy, reason }, "Emergency stop enabled");

    return updated;
  },

  /**
   * Disable emergency stop
   */
  disableEmergencyStop: async (userId: string) => {
    const [updated] = await db
      .update(agentQuotas)
      .set({
        emergencyStopEnabled: false,
        emergencyStoppedAt: null,
        emergencyStoppedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(agentQuotas.userId, userId))
      .returning();

    logger.info({ userId }, "Emergency stop disabled");

    return updated;
  },

  /**
   * Get usage history for a user
   */
  getUsageHistory: async (
    userId: string,
    options?: { days?: number }
  ) => {
    const { days = 30 } = options ?? {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return db.query.agentUsage.findMany({
      where: and(
        eq(agentUsage.userId, userId),
        sql`${agentUsage.date} >= ${startDate.toISOString().split("T")[0]}`
      ),
      orderBy: [sql`${agentUsage.date} DESC`],
    });
  },

  /**
   * Get usage summary
   */
  getUsageSummary: async (userId: string) => {
    const today = await agentSafetyService.getTodayUsage(userId);
    const quotas = await agentSafetyService.getQuotas(userId);

    return {
      today: {
        invoicesCreated: today.invoicesCreated,
        billsCreated: today.billsCreated,
        journalEntriesCreated: today.journalEntriesCreated,
        quotationsCreated: today.quotationsCreated,
        totalActions: today.totalActions,
        totalMutations: today.totalMutations,
        totalReads: today.totalReads,
        totalAmountProcessed: parseFloat(today.totalAmountProcessed ?? "0"),
        tokensUsed: today.tokensUsed,
      },
      limits: {
        dailyInvoiceLimit: quotas.dailyInvoiceLimit,
        dailyBillLimit: quotas.dailyBillLimit,
        dailyJournalEntryLimit: quotas.dailyJournalEntryLimit,
        dailyQuotationLimit: quotas.dailyQuotationLimit,
        dailyTokenLimit: quotas.dailyTokenLimit,
        maxSingleInvoiceAmount: quotas.maxSingleInvoiceAmount
          ? parseFloat(quotas.maxSingleInvoiceAmount)
          : null,
        maxSingleBillAmount: quotas.maxSingleBillAmount
          ? parseFloat(quotas.maxSingleBillAmount)
          : null,
        maxDailyTotalAmount: quotas.maxDailyTotalAmount
          ? parseFloat(quotas.maxDailyTotalAmount)
          : null,
      },
      remaining: {
        invoices: quotas.dailyInvoiceLimit - today.invoicesCreated,
        bills: quotas.dailyBillLimit - today.billsCreated,
        journalEntries: quotas.dailyJournalEntryLimit - today.journalEntriesCreated,
        quotations: quotas.dailyQuotationLimit - today.quotationsCreated,
        tokens: quotas.dailyTokenLimit - today.tokensUsed,
      },
      emergencyStopEnabled: quotas.emergencyStopEnabled,
    };
  },
};
