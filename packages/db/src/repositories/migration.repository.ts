/**
 * Migration Repository
 * Data access layer for migration sessions, opening balances, and imports
 */

import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "../index";
import {
  migrationSessions,
  openingBalanceEntries,
  openingBalanceSubledger,
  importTemplates,
  importJobs,
  payrollYtdMigration,
  accountMappingSuggestions,
  demoDataRequests,
  type MigrationSession,
  type NewMigrationSession,
  type OpeningBalanceEntry,
  type NewOpeningBalanceEntry,
  type OpeningBalanceSubledgerItem,
  type NewOpeningBalanceSubledgerItem,
  type ImportTemplate,
  type NewImportTemplate,
  type ImportJob,
  type NewImportJob,
  type PayrollYtdMigration,
  type NewPayrollYtdMigration,
  type AccountMappingSuggestion,
  type NewAccountMappingSuggestion,
  type DemoDataRequest,
  type NewDemoDataRequest,
} from "../schema";

// ============================================================================
// Migration Sessions
// ============================================================================

export const migrationSessionRepository = {
  /**
   * Create a new migration session
   */
  async create(data: NewMigrationSession): Promise<MigrationSession> {
    const [session] = await db.insert(migrationSessions).values(data).returning();
    return session!;
  },

  /**
   * Find session by ID
   */
  async findById(id: string, userId: string): Promise<MigrationSession | undefined> {
    const [session] = await db
      .select()
      .from(migrationSessions)
      .where(and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)));
    return session;
  },

  /**
   * Find active/in-progress session for user
   */
  async findActiveSession(userId: string): Promise<MigrationSession | undefined> {
    const [session] = await db
      .select()
      .from(migrationSessions)
      .where(
        and(
          eq(migrationSessions.userId, userId),
          inArray(migrationSessions.status, ["draft", "in_progress", "validating"])
        )
      )
      .orderBy(desc(migrationSessions.createdAt))
      .limit(1);
    return session;
  },

  /**
   * Find all sessions for user
   */
  async findByUser(userId: string): Promise<MigrationSession[]> {
    return db
      .select()
      .from(migrationSessions)
      .where(eq(migrationSessions.userId, userId))
      .orderBy(desc(migrationSessions.createdAt));
  },

  /**
   * Update session
   */
  async update(
    id: string,
    userId: string,
    data: Partial<NewMigrationSession>
  ): Promise<MigrationSession | undefined> {
    const [session] = await db
      .update(migrationSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)))
      .returning();
    return session;
  },

  /**
   * Update step progress
   */
  async updateProgress(
    id: string,
    userId: string,
    currentStep: string,
    completedSteps: string[]
  ): Promise<MigrationSession | undefined> {
    const [session] = await db
      .update(migrationSessions)
      .set({
        currentStep,
        completedSteps,
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)))
      .returning();
    return session;
  },

  /**
   * Update trial balance totals
   */
  async updateTrialBalance(
    id: string,
    userId: string,
    totalDebits: string,
    totalCredits: string
  ): Promise<MigrationSession | undefined> {
    const isBalanced = totalDebits === totalCredits;
    const [session] = await db
      .update(migrationSessions)
      .set({
        totalDebits,
        totalCredits,
        isBalanced,
        updatedAt: new Date(),
      })
      .where(and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)))
      .returning();
    return session;
  },

  /**
   * Complete session
   */
  async complete(id: string, userId: string): Promise<MigrationSession | undefined> {
    const [session] = await db
      .update(migrationSessions)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)))
      .returning();
    return session;
  },

  /**
   * Delete session and all related data
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await db.query.migrationSessions.findFirst({
      where: and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)),
    });
    if (!existing) return false;

    await db
      .delete(migrationSessions)
      .where(and(eq(migrationSessions.id, id), eq(migrationSessions.userId, userId)));
    return true;
  },
};

// ============================================================================
// Opening Balance Entries
// ============================================================================

export const openingBalanceRepository = {
  /**
   * Create opening balance entry
   */
  async create(data: NewOpeningBalanceEntry): Promise<OpeningBalanceEntry> {
    const [entry] = await db.insert(openingBalanceEntries).values(data).returning();
    return entry!;
  },

  /**
   * Bulk create opening balance entries
   */
  async createMany(entries: NewOpeningBalanceEntry[]): Promise<OpeningBalanceEntry[]> {
    if (entries.length === 0) return [];
    return db.insert(openingBalanceEntries).values(entries).returning();
  },

  /**
   * Find entries by session
   */
  async findBySession(sessionId: string, userId: string): Promise<OpeningBalanceEntry[]> {
    return db
      .select()
      .from(openingBalanceEntries)
      .where(
        and(
          eq(openingBalanceEntries.migrationSessionId, sessionId),
          eq(openingBalanceEntries.userId, userId)
        )
      )
      .orderBy(asc(openingBalanceEntries.accountCode));
  },

  /**
   * Find entry by ID
   */
  async findById(id: string, userId: string): Promise<OpeningBalanceEntry | undefined> {
    const [entry] = await db
      .select()
      .from(openingBalanceEntries)
      .where(and(eq(openingBalanceEntries.id, id), eq(openingBalanceEntries.userId, userId)));
    return entry;
  },

  /**
   * Update entry
   */
  async update(
    id: string,
    userId: string,
    data: Partial<NewOpeningBalanceEntry>
  ): Promise<OpeningBalanceEntry | undefined> {
    const [entry] = await db
      .update(openingBalanceEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(openingBalanceEntries.id, id), eq(openingBalanceEntries.userId, userId)))
      .returning();
    return entry;
  },

  /**
   * Delete entry
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await db.query.openingBalanceEntries.findFirst({
      where: and(eq(openingBalanceEntries.id, id), eq(openingBalanceEntries.userId, userId)),
    });
    if (!existing) return false;

    await db
      .delete(openingBalanceEntries)
      .where(and(eq(openingBalanceEntries.id, id), eq(openingBalanceEntries.userId, userId)));
    return true;
  },

  /**
   * Delete all entries for a session
   */
  async deleteBySession(sessionId: string, userId: string): Promise<number> {
    const entries = await db.query.openingBalanceEntries.findMany({
      where: and(
        eq(openingBalanceEntries.migrationSessionId, sessionId),
        eq(openingBalanceEntries.userId, userId)
      ),
    });
    if (entries.length === 0) return 0;

    await db
      .delete(openingBalanceEntries)
      .where(
        and(
          eq(openingBalanceEntries.migrationSessionId, sessionId),
          eq(openingBalanceEntries.userId, userId)
        )
      );
    return entries.length;
  },

  /**
   * Calculate totals for a session
   */
  async calculateTotals(sessionId: string, userId: string): Promise<{ totalDebits: string; totalCredits: string }> {
    const [result] = await db
      .select({
        totalDebits: sql<string>`COALESCE(SUM(${openingBalanceEntries.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${openingBalanceEntries.creditAmount}), 0)`,
      })
      .from(openingBalanceEntries)
      .where(
        and(
          eq(openingBalanceEntries.migrationSessionId, sessionId),
          eq(openingBalanceEntries.userId, userId)
        )
      );
    return {
      totalDebits: result?.totalDebits ?? "0",
      totalCredits: result?.totalCredits ?? "0",
    };
  },

  /**
   * Get validation summary
   */
  async getValidationSummary(sessionId: string, userId: string): Promise<{
    total: number;
    valid: number;
    warning: number;
    error: number;
    pending: number;
  }> {
    const entries = await db
      .select({ validationStatus: openingBalanceEntries.validationStatus })
      .from(openingBalanceEntries)
      .where(
        and(
          eq(openingBalanceEntries.migrationSessionId, sessionId),
          eq(openingBalanceEntries.userId, userId)
        )
      );

    return {
      total: entries.length,
      valid: entries.filter((e: { validationStatus: string | null }) => e.validationStatus === "valid").length,
      warning: entries.filter((e: { validationStatus: string | null }) => e.validationStatus === "warning").length,
      error: entries.filter((e: { validationStatus: string | null }) => e.validationStatus === "error").length,
      pending: entries.filter((e: { validationStatus: string | null }) => e.validationStatus === "pending").length,
    };
  },
};

// ============================================================================
// Opening Balance Subledger
// ============================================================================

export const openingBalanceSubledgerRepository = {
  /**
   * Create subledger item
   */
  async create(data: NewOpeningBalanceSubledgerItem): Promise<OpeningBalanceSubledgerItem> {
    const [item] = await db.insert(openingBalanceSubledger).values(data).returning();
    return item!;
  },

  /**
   * Bulk create subledger items
   */
  async createMany(items: NewOpeningBalanceSubledgerItem[]): Promise<OpeningBalanceSubledgerItem[]> {
    if (items.length === 0) return [];
    return db.insert(openingBalanceSubledger).values(items).returning();
  },

  /**
   * Find by opening balance entry
   */
  async findByEntry(entryId: string): Promise<OpeningBalanceSubledgerItem[]> {
    return db
      .select()
      .from(openingBalanceSubledger)
      .where(eq(openingBalanceSubledger.openingBalanceEntryId, entryId))
      .orderBy(asc(openingBalanceSubledger.referenceNumber));
  },

  /**
   * Delete by entry
   */
  async deleteByEntry(entryId: string): Promise<number> {
    const items = await db.query.openingBalanceSubledger.findMany({
      where: eq(openingBalanceSubledger.openingBalanceEntryId, entryId),
    });
    if (items.length === 0) return 0;

    await db
      .delete(openingBalanceSubledger)
      .where(eq(openingBalanceSubledger.openingBalanceEntryId, entryId));
    return items.length;
  },
};

// ============================================================================
// Import Templates
// ============================================================================

export const importTemplateRepository = {
  /**
   * Create template
   */
  async create(data: NewImportTemplate): Promise<ImportTemplate> {
    const [template] = await db.insert(importTemplates).values(data).returning();
    return template!;
  },

  /**
   * Find by user
   */
  async findByUser(userId: string): Promise<ImportTemplate[]> {
    return db
      .select()
      .from(importTemplates)
      .where(eq(importTemplates.userId, userId))
      .orderBy(desc(importTemplates.lastUsedAt), asc(importTemplates.name));
  },

  /**
   * Find by ID
   */
  async findById(id: string, userId: string): Promise<ImportTemplate | undefined> {
    const [template] = await db
      .select()
      .from(importTemplates)
      .where(and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)));
    return template;
  },

  /**
   * Find by import type
   */
  async findByType(userId: string, importType: string): Promise<ImportTemplate[]> {
    return db
      .select()
      .from(importTemplates)
      .where(
        and(
          eq(importTemplates.userId, userId),
          eq(importTemplates.importType, importType as any)
        )
      )
      .orderBy(desc(importTemplates.usageCount));
  },

  /**
   * Update template
   */
  async update(
    id: string,
    userId: string,
    data: Partial<NewImportTemplate>
  ): Promise<ImportTemplate | undefined> {
    const [template] = await db
      .update(importTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)))
      .returning();
    return template;
  },

  /**
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<void> {
    await db
      .update(importTemplates)
      .set({
        usageCount: sql`${importTemplates.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(importTemplates.id, id));
  },

  /**
   * Delete template
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await db.query.importTemplates.findFirst({
      where: and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)),
    });
    if (!existing) return false;

    await db
      .delete(importTemplates)
      .where(and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)));
    return true;
  },
};

// ============================================================================
// Import Jobs
// ============================================================================

export const importJobRepository = {
  /**
   * Create job
   */
  async create(data: NewImportJob): Promise<ImportJob> {
    const [job] = await db.insert(importJobs).values(data).returning();
    return job!;
  },

  /**
   * Find by session
   */
  async findBySession(sessionId: string): Promise<ImportJob[]> {
    return db
      .select()
      .from(importJobs)
      .where(eq(importJobs.migrationSessionId, sessionId))
      .orderBy(desc(importJobs.createdAt));
  },

  /**
   * Find by ID
   */
  async findById(id: string, userId: string): Promise<ImportJob | undefined> {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, id), eq(importJobs.userId, userId)));
    return job;
  },

  /**
   * Update job
   */
  async update(id: string, data: Partial<NewImportJob>): Promise<ImportJob | undefined> {
    const [job] = await db.update(importJobs).set(data).where(eq(importJobs.id, id)).returning();
    return job;
  },

  /**
   * Update progress
   */
  async updateProgress(
    id: string,
    processedRows: number,
    successRows: number,
    errorRows: number,
    errors?: Array<{ row: number; field?: string; value?: string; error: string }>
  ): Promise<void> {
    await db
      .update(importJobs)
      .set({
        processedRows,
        successRows,
        errorRows,
        errors: errors ?? [],
      })
      .where(eq(importJobs.id, id));
  },

  /**
   * Complete job
   */
  async complete(id: string, success: boolean): Promise<ImportJob | undefined> {
    const [job] = await db
      .update(importJobs)
      .set({
        status: success ? "completed" : "failed",
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, id))
      .returning();
    return job;
  },
};

// ============================================================================
// Payroll YTD Migration
// ============================================================================

export const payrollYtdRepository = {
  /**
   * Create YTD record
   */
  async create(data: NewPayrollYtdMigration): Promise<PayrollYtdMigration> {
    const [record] = await db.insert(payrollYtdMigration).values(data).returning();
    return record!;
  },

  /**
   * Bulk create
   */
  async createMany(records: NewPayrollYtdMigration[]): Promise<PayrollYtdMigration[]> {
    if (records.length === 0) return [];
    return db.insert(payrollYtdMigration).values(records).returning();
  },

  /**
   * Find by session
   */
  async findBySession(sessionId: string): Promise<PayrollYtdMigration[]> {
    return db
      .select()
      .from(payrollYtdMigration)
      .where(eq(payrollYtdMigration.migrationSessionId, sessionId));
  },

  /**
   * Find by employee
   */
  async findByEmployee(employeeId: string): Promise<PayrollYtdMigration | undefined> {
    const [record] = await db
      .select()
      .from(payrollYtdMigration)
      .where(eq(payrollYtdMigration.employeeId, employeeId))
      .orderBy(desc(payrollYtdMigration.asOfDate))
      .limit(1);
    return record;
  },

  /**
   * Update record
   */
  async update(
    id: string,
    userId: string,
    data: Partial<NewPayrollYtdMigration>
  ): Promise<PayrollYtdMigration | undefined> {
    const [record] = await db
      .update(payrollYtdMigration)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(payrollYtdMigration.id, id), eq(payrollYtdMigration.userId, userId)))
      .returning();
    return record;
  },

  /**
   * Delete single record
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await db.query.payrollYtdMigration.findFirst({
      where: and(eq(payrollYtdMigration.id, id), eq(payrollYtdMigration.userId, userId)),
    });
    if (!existing) return false;

    await db
      .delete(payrollYtdMigration)
      .where(and(eq(payrollYtdMigration.id, id), eq(payrollYtdMigration.userId, userId)));
    return true;
  },

  /**
   * Delete by session
   */
  async deleteBySession(sessionId: string): Promise<number> {
    const records = await db.query.payrollYtdMigration.findMany({
      where: eq(payrollYtdMigration.migrationSessionId, sessionId),
    });
    if (records.length === 0) return 0;

    await db
      .delete(payrollYtdMigration)
      .where(eq(payrollYtdMigration.migrationSessionId, sessionId));
    return records.length;
  },
};

// ============================================================================
// Account Mapping Suggestions
// ============================================================================

export const accountMappingRepository = {
  /**
   * Create suggestion
   */
  async create(data: NewAccountMappingSuggestion): Promise<AccountMappingSuggestion> {
    const [suggestion] = await db.insert(accountMappingSuggestions).values(data).returning();
    return suggestion!;
  },

  /**
   * Bulk create
   */
  async createMany(suggestions: NewAccountMappingSuggestion[]): Promise<AccountMappingSuggestion[]> {
    if (suggestions.length === 0) return [];
    return db.insert(accountMappingSuggestions).values(suggestions).returning();
  },

  /**
   * Find by session
   */
  async findBySession(sessionId: string): Promise<AccountMappingSuggestion[]> {
    return db
      .select()
      .from(accountMappingSuggestions)
      .where(eq(accountMappingSuggestions.migrationSessionId, sessionId))
      .orderBy(desc(accountMappingSuggestions.confidence));
  },

  /**
   * Find pending (needs review)
   */
  async findPending(sessionId: string): Promise<AccountMappingSuggestion[]> {
    return db
      .select()
      .from(accountMappingSuggestions)
      .where(
        and(
          eq(accountMappingSuggestions.migrationSessionId, sessionId),
          eq(accountMappingSuggestions.status, "pending")
        )
      )
      .orderBy(asc(accountMappingSuggestions.confidence));
  },

  /**
   * Update status (accept/reject)
   */
  async updateStatus(
    id: string,
    userId: string,
    status: "accepted" | "rejected" | "manual",
    userSelectedAccountId?: string
  ): Promise<AccountMappingSuggestion | undefined> {
    const [suggestion] = await db
      .update(accountMappingSuggestions)
      .set({
        status,
        userSelectedAccountId,
        updatedAt: new Date(),
      })
      .where(and(eq(accountMappingSuggestions.id, id), eq(accountMappingSuggestions.userId, userId)))
      .returning();
    return suggestion;
  },

  /**
   * Auto-accept high confidence mappings
   */
  async autoAcceptHighConfidence(sessionId: string, minConfidence = 0.95): Promise<number> {
    // Find matching records first
    const matching = await db.query.accountMappingSuggestions.findMany({
      where: and(
        eq(accountMappingSuggestions.migrationSessionId, sessionId),
        eq(accountMappingSuggestions.status, "pending"),
        sql`${accountMappingSuggestions.confidence} >= ${minConfidence}`
      ),
    });
    if (matching.length === 0) return 0;

    await db
      .update(accountMappingSuggestions)
      .set({
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accountMappingSuggestions.migrationSessionId, sessionId),
          eq(accountMappingSuggestions.status, "pending"),
          sql`${accountMappingSuggestions.confidence} >= ${minConfidence}`
        )
      );
    return matching.length;
  },

  /**
   * Delete by session
   */
  async deleteBySession(sessionId: string): Promise<number> {
    const records = await db.query.accountMappingSuggestions.findMany({
      where: eq(accountMappingSuggestions.migrationSessionId, sessionId),
    });
    if (records.length === 0) return 0;

    await db
      .delete(accountMappingSuggestions)
      .where(eq(accountMappingSuggestions.migrationSessionId, sessionId));
    return records.length;
  },
};

// ============================================================================
// Demo Data Requests
// ============================================================================

export const demoDataRepository = {
  /**
   * Create request
   */
  async create(data: NewDemoDataRequest): Promise<DemoDataRequest> {
    const [request] = await db.insert(demoDataRequests).values(data).returning();
    return request!;
  },

  /**
   * Find latest by user
   */
  async findLatestByUser(userId: string): Promise<DemoDataRequest | undefined> {
    const [request] = await db
      .select()
      .from(demoDataRequests)
      .where(eq(demoDataRequests.userId, userId))
      .orderBy(desc(demoDataRequests.createdAt))
      .limit(1);
    return request;
  },

  /**
   * Update request
   */
  async update(id: string, data: Partial<NewDemoDataRequest>): Promise<DemoDataRequest | undefined> {
    const [request] = await db
      .update(demoDataRequests)
      .set(data)
      .where(eq(demoDataRequests.id, id))
      .returning();
    return request;
  },

  /**
   * Complete request
   */
  async complete(
    id: string,
    generatedCounts: Record<string, number>
  ): Promise<DemoDataRequest | undefined> {
    const [request] = await db
      .update(demoDataRequests)
      .set({
        status: "completed",
        generatedCounts,
        completedAt: new Date(),
      })
      .where(eq(demoDataRequests.id, id))
      .returning();
    return request;
  },
};
