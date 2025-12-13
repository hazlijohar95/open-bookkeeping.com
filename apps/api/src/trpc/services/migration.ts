/**
 * Migration tRPC Service
 * Handles data migration, opening balances, and setup wizard operations
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  migrationSessionRepository,
  openingBalanceRepository,
  openingBalanceSubledgerRepository,
  importTemplateRepository,
  payrollYtdRepository,
  accountMappingRepository,
  demoDataRepository,
  accountRepository,
} from "@open-bookkeeping/db";

// ============================================================================
// Zod Schemas
// ============================================================================

const createSessionSchema = z.object({
  name: z.string().optional(),
  sourceSystem: z.enum(["quickbooks", "xero", "sage", "wave", "zoho", "sql_accounting", "autocount", "custom"]).optional(),
  conversionDate: z.string().optional(),
  financialYearStart: z.string().optional(),
});

const updateSessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  sourceSystem: z.enum(["quickbooks", "xero", "sage", "wave", "zoho", "sql_accounting", "autocount", "custom"]).optional(),
  conversionDate: z.string().optional(),
  financialYearStart: z.string().optional(),
  currentStep: z.string().optional(),
  completedSteps: z.array(z.string()).optional(),
});

const openingBalanceEntrySchema = z.object({
  accountCode: z.string().min(1),
  accountName: z.string().min(1),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  debitAmount: z.string().default("0"),
  creditAmount: z.string().default("0"),
  accountId: z.string().uuid().optional(),
});

const bulkOpeningBalanceSchema = z.object({
  sessionId: z.string().uuid(),
  entries: z.array(openingBalanceEntrySchema),
});

const subledgerItemSchema = z.object({
  entityType: z.enum(["customer", "vendor"]),
  entityName: z.string().min(1),
  referenceNumber: z.string().min(1),
  documentDate: z.string().optional(),
  dueDate: z.string().optional(),
  originalAmount: z.string(),
  outstandingAmount: z.string(),
  currency: z.string().default("MYR"),
  description: z.string().optional(),
  entityId: z.string().uuid().optional(),
});

const importTemplateSchema = z.object({
  name: z.string().min(1),
  importType: z.enum([
    "chart_of_accounts",
    "opening_balances",
    "customers",
    "vendors",
    "open_invoices",
    "open_bills",
    "bank_transactions",
    "employees",
    "payroll_ytd",
  ]),
  sourceSystem: z.enum(["quickbooks", "xero", "sage", "wave", "zoho", "sql_accounting", "autocount", "custom"]).optional(),
  columnMapping: z.array(z.object({
    sourceColumn: z.string(),
    targetField: z.string(),
    transform: z.string().optional(),
    defaultValue: z.string().optional(),
    required: z.boolean(),
  })),
  hasHeaderRow: z.boolean().default(true),
  delimiter: z.string().default(","),
  dateFormat: z.string().default("DD/MM/YYYY"),
  decimalSeparator: z.string().default("."),
});

const payrollYtdSchema = z.object({
  sessionId: z.string().uuid(),
  employeeId: z.string().uuid(),
  asOfDate: z.string(),
  monthsWorked: z.number().int().min(0).max(12),
  ytdGrossSalary: z.string(),
  ytdBaseSalary: z.string(),
  ytdAllowances: z.string().default("0"),
  ytdOtherEarnings: z.string().default("0"),
  ytdTotalDeductions: z.string().default("0"),
  ytdOtherDeductions: z.string().default("0"),
  ytdEpfEmployee: z.string(),
  ytdSocsoEmployee: z.string(),
  ytdEisEmployee: z.string(),
  ytdPcb: z.string(),
  ytdEpfEmployer: z.string(),
  ytdSocsoEmployer: z.string(),
  ytdEisEmployer: z.string(),
  ytdNetSalary: z.string(),
});

const demoDataOptionsSchema = z.object({
  customers: z.number().int().min(0).max(50).default(10),
  vendors: z.number().int().min(0).max(30).default(5),
  invoices: z.number().int().min(0).max(100).default(20),
  bills: z.number().int().min(0).max(100).default(15),
  bankTransactions: z.number().int().min(0).max(200).default(50),
  employees: z.number().int().min(0).max(20).default(5),
  dateRange: z.enum(["1month", "3months", "6months", "1year"]).default("3months"),
});

// ============================================================================
// Router
// ============================================================================

export const migrationRouter = router({
  // -------------------------------------------------------------------------
  // Migration Sessions
  // -------------------------------------------------------------------------

  /**
   * Get or create active migration session
   */
  getOrCreateSession: protectedProcedure
    .input(createSessionSchema.optional())
    .mutation(async ({ ctx, input }) => {
      // Check for existing active session
      const existing = await migrationSessionRepository.findActiveSession(ctx.user.id);
      if (existing) {
        return existing;
      }

      // Create new session
      return migrationSessionRepository.create({
        userId: ctx.user.id,
        name: input?.name ?? "Data Migration",
        sourceSystem: input?.sourceSystem,
        conversionDate: input?.conversionDate,
        financialYearStart: input?.financialYearStart,
      });
    }),

  /**
   * Get session by ID
   */
  getSession: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await migrationSessionRepository.findById(input.id, ctx.user.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }
      return session;
    }),

  /**
   * Get all sessions for user
   */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    return migrationSessionRepository.findByUser(ctx.user.id);
  }),

  /**
   * Update session
   */
  updateSession: protectedProcedure
    .input(updateSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const session = await migrationSessionRepository.update(id, ctx.user.id, data);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }
      return session;
    }),

  /**
   * Update wizard progress
   */
  updateProgress: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      currentStep: z.string(),
      completedSteps: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await migrationSessionRepository.updateProgress(
        input.sessionId,
        ctx.user.id,
        input.currentStep,
        input.completedSteps
      );
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }
      return session;
    }),

  /**
   * Complete migration session
   */
  completeSession: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await migrationSessionRepository.complete(input.id, ctx.user.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }
      return session;
    }),

  /**
   * Delete session
   */
  deleteSession: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await migrationSessionRepository.delete(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }
      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Opening Balances
  // -------------------------------------------------------------------------

  /**
   * Get opening balance entries for session
   */
  getOpeningBalances: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return openingBalanceRepository.findBySession(input.sessionId, ctx.user.id);
    }),

  /**
   * Add single opening balance entry
   */
  addOpeningBalance: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      entry: openingBalanceEntrySchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return openingBalanceRepository.create({
        migrationSessionId: input.sessionId,
        userId: ctx.user.id,
        ...input.entry,
      });
    }),

  /**
   * Bulk add opening balance entries
   */
  bulkAddOpeningBalances: protectedProcedure
    .input(bulkOpeningBalanceSchema)
    .mutation(async ({ ctx, input }) => {
      // Delete existing entries first
      await openingBalanceRepository.deleteBySession(input.sessionId, ctx.user.id);

      // Create new entries
      const entries = input.entries.map((entry) => ({
        migrationSessionId: input.sessionId,
        userId: ctx.user.id,
        ...entry,
      }));

      const created = await openingBalanceRepository.createMany(entries);

      // Calculate and update trial balance totals
      const totals = await openingBalanceRepository.calculateTotals(input.sessionId, ctx.user.id);
      await migrationSessionRepository.updateTrialBalance(
        input.sessionId,
        ctx.user.id,
        totals.totalDebits,
        totals.totalCredits
      );

      return { entries: created, totals };
    }),

  /**
   * Update opening balance entry
   */
  updateOpeningBalance: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      entry: openingBalanceEntrySchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await openingBalanceRepository.update(input.id, ctx.user.id, input.entry);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opening balance entry not found" });
      }

      // Recalculate totals
      if (updated.migrationSessionId) {
        const totals = await openingBalanceRepository.calculateTotals(
          updated.migrationSessionId,
          ctx.user.id
        );
        await migrationSessionRepository.updateTrialBalance(
          updated.migrationSessionId,
          ctx.user.id,
          totals.totalDebits,
          totals.totalCredits
        );
      }

      return updated;
    }),

  /**
   * Delete opening balance entry
   */
  deleteOpeningBalance: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await openingBalanceRepository.findById(input.id, ctx.user.id);
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opening balance entry not found" });
      }

      await openingBalanceRepository.delete(input.id, ctx.user.id);

      // Recalculate totals
      if (entry.migrationSessionId) {
        const totals = await openingBalanceRepository.calculateTotals(
          entry.migrationSessionId,
          ctx.user.id
        );
        await migrationSessionRepository.updateTrialBalance(
          entry.migrationSessionId,
          ctx.user.id,
          totals.totalDebits,
          totals.totalCredits
        );
      }

      return { success: true };
    }),

  /**
   * Get trial balance summary
   */
  getTrialBalanceSummary: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const totals = await openingBalanceRepository.calculateTotals(input.sessionId, ctx.user.id);
      const validation = await openingBalanceRepository.getValidationSummary(input.sessionId, ctx.user.id);

      return {
        ...totals,
        isBalanced: totals.totalDebits === totals.totalCredits,
        difference: (parseFloat(totals.totalDebits) - parseFloat(totals.totalCredits)).toFixed(2),
        validation,
      };
    }),

  // -------------------------------------------------------------------------
  // Subledger (AR/AP Detail)
  // -------------------------------------------------------------------------

  /**
   * Get subledger items for an opening balance entry
   */
  getSubledgerItems: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .query(async ({ input }) => {
      return openingBalanceSubledgerRepository.findByEntry(input.entryId);
    }),

  /**
   * Add subledger items
   */
  addSubledgerItems: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      items: z.array(subledgerItemSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify entry exists and belongs to user
      const entry = await openingBalanceRepository.findById(input.entryId, ctx.user.id);
      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Opening balance entry not found" });
      }

      // Delete existing items
      await openingBalanceSubledgerRepository.deleteByEntry(input.entryId);

      // Create new items
      const items = input.items.map((item) => ({
        openingBalanceEntryId: input.entryId,
        userId: ctx.user.id,
        ...item,
      }));

      const created = await openingBalanceSubledgerRepository.createMany(items);

      // Mark entry as having subledger detail
      await openingBalanceRepository.update(input.entryId, ctx.user.id, {
        hasSubledgerDetail: true,
      });

      return created;
    }),

  // -------------------------------------------------------------------------
  // Import Templates
  // -------------------------------------------------------------------------

  /**
   * List import templates
   */
  listTemplates: protectedProcedure
    .input(z.object({
      importType: z.enum([
        "chart_of_accounts",
        "opening_balances",
        "customers",
        "vendors",
        "open_invoices",
        "open_bills",
        "bank_transactions",
        "employees",
        "payroll_ytd",
      ]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.importType) {
        return importTemplateRepository.findByType(ctx.user.id, input.importType);
      }
      return importTemplateRepository.findByUser(ctx.user.id);
    }),

  /**
   * Create import template
   */
  createTemplate: protectedProcedure
    .input(importTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return importTemplateRepository.create({
        userId: ctx.user.id,
        ...input,
      });
    }),

  /**
   * Update import template
   */
  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: importTemplateSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await importTemplateRepository.update(input.id, ctx.user.id, input.data);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return updated;
    }),

  /**
   * Delete import template
   */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await importTemplateRepository.delete(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Account Mapping
  // -------------------------------------------------------------------------

  /**
   * Get account mapping suggestions
   */
  getMappingSuggestions: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return accountMappingRepository.findBySession(input.sessionId);
    }),

  /**
   * Get pending mappings (need review)
   */
  getPendingMappings: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return accountMappingRepository.findPending(input.sessionId);
    }),

  /**
   * Update mapping status
   */
  updateMappingStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(["accepted", "rejected", "manual"]),
      userSelectedAccountId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await accountMappingRepository.updateStatus(
        input.id,
        ctx.user.id,
        input.status,
        input.userSelectedAccountId
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping suggestion not found" });
      }
      return updated;
    }),

  /**
   * Auto-accept high confidence mappings
   */
  autoAcceptMappings: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      minConfidence: z.number().min(0).max(1).default(0.95),
    }))
    .mutation(async ({ input }) => {
      const count = await accountMappingRepository.autoAcceptHighConfidence(
        input.sessionId,
        input.minConfidence
      );
      return { acceptedCount: count };
    }),

  /**
   * Generate account mapping suggestions using AI
   */
  generateMappingSuggestions: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      sourceAccounts: z.array(z.object({
        code: z.string(),
        name: z.string(),
        type: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get existing chart of accounts
      const existingAccounts = await accountRepository.findAll(ctx.user.id);

      // Generate suggestions based on name/code matching
      const suggestions = input.sourceAccounts.map((source) => {
        // Find best match from existing accounts
        let bestMatch = null;
        let bestConfidence = 0;
        let reasoning = "";

        for (const account of existingAccounts) {
          // Exact code match
          if (account.code.toLowerCase() === source.code.toLowerCase()) {
            bestMatch = account;
            bestConfidence = 1.0;
            reasoning = "Exact code match";
            break;
          }

          // Name similarity
          const sourceNameLower = source.name.toLowerCase();
          const accountNameLower = account.name.toLowerCase();

          if (sourceNameLower === accountNameLower) {
            if (bestConfidence < 0.95) {
              bestMatch = account;
              bestConfidence = 0.95;
              reasoning = "Exact name match";
            }
          } else if (accountNameLower.includes(sourceNameLower) || sourceNameLower.includes(accountNameLower)) {
            if (bestConfidence < 0.7) {
              bestMatch = account;
              bestConfidence = 0.7;
              reasoning = "Partial name match";
            }
          }

          // Type matching
          if (source.type && account.accountType === source.type) {
            if (bestConfidence < 0.5) {
              bestMatch = account;
              bestConfidence = 0.5;
              reasoning = "Account type match";
            }
          }
        }

        return {
          migrationSessionId: input.sessionId,
          userId: ctx.user.id,
          sourceCode: source.code,
          sourceName: source.name,
          sourceType: source.type ?? null,
          targetAccountId: bestMatch?.id ?? null,
          targetAccountCode: bestMatch?.code ?? null,
          targetAccountName: bestMatch?.name ?? null,
          confidence: bestConfidence.toFixed(2),
          reasoning: reasoning || "No match found",
          status: "pending",
        };
      });

      // Clear existing suggestions
      await accountMappingRepository.deleteBySession(input.sessionId);

      // Save new suggestions
      const created = await accountMappingRepository.createMany(suggestions);

      // Auto-accept high confidence ones
      await accountMappingRepository.autoAcceptHighConfidence(input.sessionId, 0.95);

      return created;
    }),

  // -------------------------------------------------------------------------
  // Payroll YTD Migration
  // -------------------------------------------------------------------------

  /**
   * Get payroll YTD records for session
   */
  getPayrollYtd: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return payrollYtdRepository.findBySession(input.sessionId);
    }),

  /**
   * Add payroll YTD record
   */
  addPayrollYtd: protectedProcedure
    .input(payrollYtdSchema)
    .mutation(async ({ ctx, input }) => {
      const { sessionId, ...rest } = input;
      return payrollYtdRepository.create({
        ...rest,
        migrationSessionId: sessionId,
        userId: ctx.user.id,
      });
    }),

  /**
   * Bulk add payroll YTD records
   */
  bulkAddPayrollYtd: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      records: z.array(payrollYtdSchema.omit({ sessionId: true })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Delete existing records for this session
      await payrollYtdRepository.deleteBySession(input.sessionId);

      // Create new records
      const records = input.records.map((record) => ({
        ...record,
        migrationSessionId: input.sessionId,
        userId: ctx.user.id,
      }));

      return payrollYtdRepository.createMany(records);
    }),

  /**
   * Update payroll YTD record
   */
  updatePayrollYtd: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: payrollYtdSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await payrollYtdRepository.update(input.id, ctx.user.id, input.data);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll YTD record not found" });
      }
      return updated;
    }),

  /**
   * Delete payroll YTD record
   */
  deletePayrollYtd: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await payrollYtdRepository.delete(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll YTD record not found" });
      }
      return { success: true };
    }),

  // -------------------------------------------------------------------------
  // Demo Data
  // -------------------------------------------------------------------------

  /**
   * Request demo data generation
   */
  requestDemoData: protectedProcedure
    .input(demoDataOptionsSchema)
    .mutation(async ({ ctx, input }) => {
      // Create demo data request
      const request = await demoDataRepository.create({
        userId: ctx.user.id,
        options: input,
        status: "pending",
      });

      // TODO: In production, this would trigger a background job
      // For now, we'll return the request and handle generation separately

      return request;
    }),

  /**
   * Get demo data request status
   */
  getDemoDataStatus: protectedProcedure.query(async ({ ctx }) => {
    return demoDataRepository.findLatestByUser(ctx.user.id);
  }),

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Run full validation on migration session
   */
  validateSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await migrationSessionRepository.findById(input.sessionId, ctx.user.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }

      // Get opening balances
      const entries = await openingBalanceRepository.findBySession(input.sessionId, ctx.user.id);
      const totals = await openingBalanceRepository.calculateTotals(input.sessionId, ctx.user.id);

      // Run validation checks
      const checks: Array<{
        check: string;
        status: "pass" | "warning" | "error";
        message: string;
        action?: string;
      }> = [];

      // Check 1: Trial balance
      const isBalanced = totals.totalDebits === totals.totalCredits;
      checks.push({
        check: "Trial Balance",
        status: isBalanced ? "pass" : "error",
        message: isBalanced
          ? `Balanced: RM ${parseFloat(totals.totalDebits).toLocaleString()}`
          : `Unbalanced: Debits RM ${parseFloat(totals.totalDebits).toLocaleString()} vs Credits RM ${parseFloat(totals.totalCredits).toLocaleString()}`,
        action: isBalanced ? undefined : "Review entries to balance",
      });

      // Check 2: Has entries
      checks.push({
        check: "Opening Balances",
        status: entries.length > 0 ? "pass" : "warning",
        message: entries.length > 0
          ? `${entries.length} accounts with opening balances`
          : "No opening balances entered",
        action: entries.length > 0 ? undefined : "Add opening balances",
      });

      // Check 3: Account mapping
      const mappings = await accountMappingRepository.findPending(input.sessionId);
      checks.push({
        check: "Account Mapping",
        status: mappings.length === 0 ? "pass" : "warning",
        message: mappings.length === 0
          ? "All accounts mapped"
          : `${mappings.length} accounts need manual mapping`,
        action: mappings.length === 0 ? undefined : "Review account mappings",
      });

      // Check 4: Conversion date
      checks.push({
        check: "Conversion Date",
        status: session.conversionDate ? "pass" : "warning",
        message: session.conversionDate
          ? `Conversion date: ${session.conversionDate}`
          : "No conversion date set",
        action: session.conversionDate ? undefined : "Set conversion date",
      });

      // Calculate overall status
      const hasErrors = checks.some((c) => c.status === "error");
      const hasWarnings = checks.some((c) => c.status === "warning");
      const overallStatus = hasErrors ? "error" : hasWarnings ? "warning" : "valid";

      // Update session with validation results
      const validationResults = {
        totalChecks: checks.length,
        passed: checks.filter((c) => c.status === "pass").length,
        warnings: checks.filter((c) => c.status === "warning").length,
        errors: checks.filter((c) => c.status === "error").length,
        details: checks,
      };

      await migrationSessionRepository.update(input.sessionId, ctx.user.id, {
        validationStatus: overallStatus,
        validationResults,
        status: "validated",
      });

      return validationResults;
    }),

  // -------------------------------------------------------------------------
  // Apply Migration (Finalize)
  // -------------------------------------------------------------------------

  /**
   * Apply opening balances to chart of accounts
   */
  applyOpeningBalances: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await migrationSessionRepository.findById(input.sessionId, ctx.user.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Migration session not found" });
      }

      if (session.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Migration already completed" });
      }

      const entries = await openingBalanceRepository.findBySession(input.sessionId, ctx.user.id);

      // Update each account with opening balance
      for (const entry of entries) {
        if (entry.accountId) {
          const balance = parseFloat(entry.debitAmount) - parseFloat(entry.creditAmount);
          await accountRepository.update(entry.accountId, ctx.user.id, {
            openingBalance: balance.toFixed(2),
            openingBalanceDate: session.conversionDate ?? undefined,
          });
        }
      }

      // Mark session as completed
      await migrationSessionRepository.complete(input.sessionId, ctx.user.id);

      return {
        success: true,
        appliedCount: entries.filter((e: { accountId: string | null }) => e.accountId).length,
      };
    }),
});
