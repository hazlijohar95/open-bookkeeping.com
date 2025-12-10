import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { chartOfAccountsRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("chart-of-accounts-service");

// Enum schemas
const accountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

const normalBalanceSchema = z.enum(["debit", "credit"]);

const journalEntryStatusSchema = z.enum(["draft", "posted", "reversed"]);

const sourceDocumentTypeSchema = z.enum([
  "invoice",
  "bill",
  "bank_transaction",
  "manual",
  "credit_note",
  "debit_note",
]);

const sstTaxCodeSchema = z.enum([
  "sr",
  "zrl",
  "es",
  "os",
  "rs",
  "gs",
  "none",
]);

// Account schemas
const createAccountSchema = z.object({
  code: z
    .string()
    .min(1, "Account code is required")
    .max(20, "Account code must be at most 20 characters")
    .regex(/^[A-Za-z0-9]+$/, "Account code must be alphanumeric"),
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be at most 100 characters"),
  description: z.string().max(500).optional(),
  accountType: accountTypeSchema,
  normalBalance: normalBalanceSchema,
  parentId: z.string().uuid().optional(),
  sstTaxCode: sstTaxCodeSchema.optional(),
  isHeader: z.boolean().default(false),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const updateAccountSchema = z.object({
  id: z.string().uuid(),
  code: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sstTaxCode: sstTaxCodeSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  isHeader: z.boolean().optional(),
  openingBalance: z.string().optional().nullable(),
  openingBalanceDate: z.string().optional().nullable(),
});

const accountFilterSchema = z.object({
  accountType: accountTypeSchema.optional(),
  isActive: z.boolean().optional(),
  isHeader: z.boolean().optional(),
  parentId: z.string().uuid().optional().nullable(),
});

// Journal entry schemas
const journalEntryLineSchema = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.string().optional(),
  creditAmount: z.string().optional(),
  sstTaxCode: sstTaxCodeSchema.optional(),
  taxAmount: z.string().optional(),
  description: z.string().optional(),
});

const createJournalEntrySchema = z.object({
  entryDate: z.string(),
  description: z.string().min(1, "Description is required").max(500),
  reference: z.string().max(100).optional(),
  sourceType: sourceDocumentTypeSchema.optional(),
  sourceId: z.string().uuid().optional(),
  lines: z
    .array(journalEntryLineSchema)
    .min(2, "Journal entry must have at least 2 lines"),
});

const journalEntryFilterSchema = z.object({
  status: journalEntryStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sourceType: sourceDocumentTypeSchema.optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const chartOfAccountsRouter = router({
  // ============= Account Endpoints =============

  initializeDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await chartOfAccountsRepository.initializeDefaults(
        ctx.user.id
      );
      logger.info({ userId: ctx.user.id, count: result.accountsCreated }, `Initialized ${result.accountsCreated} default accounts`);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("already has accounts")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Default accounts have already been initialized",
        });
      }
      logger.error({ error }, "Failed to initialize default accounts");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to initialize default accounts",
      });
    }
  }),

  listAccounts: protectedProcedure
    .input(accountFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const accounts = await chartOfAccountsRepository.findAllAccounts(
        ctx.user.id,
        input || undefined
      );
      return accounts;
    }),

  getAccountTree: protectedProcedure
    .input(
      z.object({
        accountType: accountTypeSchema.optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const tree = await chartOfAccountsRepository.getAccountTree(
        ctx.user.id,
        input?.accountType
      );
      return tree;
    }),

  getAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const account = await chartOfAccountsRepository.findAccountById(
        input.id,
        ctx.user.id
      );

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Get balance for this account
      const balance = await chartOfAccountsRepository.getAccountBalance(
        input.id,
        ctx.user.id
      );

      return { ...account, balance: balance?.balance || "0" };
    }),

  createAccount: protectedProcedure
    .input(createAccountSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const account = await chartOfAccountsRepository.createAccount({
          userId: ctx.user.id,
          ...input,
        });

        if (!account) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }

        logger.info({ userId: ctx.user.id, accountCode: account.code }, `Created account ${account.code}`);
        return account;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("already exists")) {
            throw new TRPCError({
              code: "CONFLICT",
              message: error.message,
            });
          }
          if (error.message.includes("Parent account not found")) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }
        logger.error({ error }, "Failed to create account");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account",
        });
      }
    }),

  updateAccount: protectedProcedure
    .input(updateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      try {
        const account = await chartOfAccountsRepository.updateAccount(
          id,
          ctx.user.id,
          updateData
        );

        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        logger.info({ userId: ctx.user.id, accountCode: account.code }, `Updated account ${account.code}`);
        return account;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error) {
          if (error.message.includes("Parent account not found")) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }
        logger.error({ error }, "Failed to update account");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update account",
        });
      }
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await chartOfAccountsRepository.deleteAccount(
        input.id,
        ctx.user.id
      );

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to delete account",
        });
      }

      logger.info({ userId: ctx.user.id, accountId: input.id }, `Deleted account ${input.id}`);
      return { success: true };
    }),

  // ============= Journal Entry Endpoints =============

  listJournalEntries: protectedProcedure
    .input(journalEntryFilterSchema.optional())
    .query(async ({ ctx, input }) => {
      const entries = await chartOfAccountsRepository.findAllJournalEntries(
        ctx.user.id,
        input || undefined
      );
      return entries;
    }),

  getJournalEntry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entry = await chartOfAccountsRepository.findJournalEntryById(
        input.id,
        ctx.user.id
      );

      if (!entry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Journal entry not found",
        });
      }

      return entry;
    }),

  createJournalEntry: protectedProcedure
    .input(createJournalEntrySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const entry = await chartOfAccountsRepository.createJournalEntry({
          userId: ctx.user.id,
          ...input,
        });

        if (!entry) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create journal entry",
          });
        }

        logger.info({ userId: ctx.user.id, entryNumber: entry.entryNumber }, `Created journal entry ${entry.entryNumber}`);
        return entry;
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes("must equal") ||
            error.message.includes("header accounts") ||
            error.message.includes("not found")
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }
        logger.error({ error }, "Failed to create journal entry");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create journal entry",
        });
      }
    }),

  postJournalEntry: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await chartOfAccountsRepository.postJournalEntry(
          input.id,
          ctx.user.id
        );

        logger.info({ userId: ctx.user.id, entryId: input.id }, `Posted journal entry ${input.id}`);
        return result;
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes("not found") ||
            error.message.includes("Can only post")
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }
        logger.error({ error }, "Failed to post journal entry");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to post journal entry",
        });
      }
    }),

  reverseJournalEntry: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reversalDate: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const reversal = await chartOfAccountsRepository.reverseJournalEntry(
          input.id,
          ctx.user.id,
          input.reversalDate
        );

        logger.info({ userId: ctx.user.id, entryId: input.id }, `Reversed journal entry ${input.id}`);
        return reversal;
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes("not found") ||
            error.message.includes("Can only reverse")
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: error.message,
            });
          }
        }
        logger.error({ error }, "Failed to reverse journal entry");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reverse journal entry",
        });
      }
    }),

  // ============= Balance & Report Endpoints =============

  getAccountBalance: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        asOfDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const balance = await chartOfAccountsRepository.getAccountBalance(
        input.accountId,
        ctx.user.id,
        input.asOfDate
      );

      if (!balance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      return balance;
    }),

  getTrialBalance: protectedProcedure
    .input(
      z.object({
        asOfDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const trialBalance = await chartOfAccountsRepository.getTrialBalance(
        ctx.user.id,
        input?.asOfDate
      );
      return trialBalance;
    }),

  getAccountSummary: protectedProcedure.query(async ({ ctx }) => {
    const summary = await chartOfAccountsRepository.getAccountSummaryByType(
      ctx.user.id
    );
    return summary;
  }),

  // ============= Utility Endpoints =============

  checkHasAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await chartOfAccountsRepository.findAllAccounts(
      ctx.user.id,
      { isActive: true }
    );
    return { hasAccounts: accounts.length > 0, count: accounts.length };
  }),

  getSystemAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await chartOfAccountsRepository.findAllAccounts(ctx.user.id);
    return accounts.filter((a) => a.isSystemAccount);
  }),

  searchAccounts: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        accountType: accountTypeSchema.optional(),
        excludeHeaders: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const allAccounts = await chartOfAccountsRepository.findAllAccounts(
        ctx.user.id,
        {
          accountType: input.accountType,
          isActive: true,
          isHeader: input.excludeHeaders ? false : undefined,
        }
      );

      const query = input.query.toLowerCase();
      return allAccounts.filter(
        (a) =>
          a.code.toLowerCase().includes(query) ||
          a.name.toLowerCase().includes(query)
      );
    }),
});

export type ChartOfAccountsRouter = typeof chartOfAccountsRouter;
