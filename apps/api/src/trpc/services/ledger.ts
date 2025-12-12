import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  ledgerRepository,
  accountingPeriodRepository,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("ledger-service");

// ============= Schemas =============

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const generalLedgerOptionsSchema = z.object({
  accountId: z.string().uuid(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

const trialBalanceOptionsSchema = z.object({
  asOfDate: dateSchema,
});

const profitLossOptionsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
});

const profitLossComparativeOptionsSchema = z.object({
  currentPeriod: z.object({
    startDate: dateSchema,
    endDate: dateSchema,
  }),
  comparePeriod: z.object({
    startDate: dateSchema,
    endDate: dateSchema,
  }),
});

const balanceSheetOptionsSchema = z.object({
  asOfDate: dateSchema,
});

const balanceSheetComparativeOptionsSchema = z.object({
  currentAsOfDate: dateSchema,
  compareAsOfDate: dateSchema,
});

const transactionSearchOptionsSchema = z.object({
  query: z.string().min(1),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.number().min(1).max(500).default(100),
  offset: z.number().min(0).default(0),
});

const periodStatusSchema = z.object({
  year: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
});

const closePeriodSchema = z.object({
  year: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
  notes: z.string().optional(),
});

const reopenPeriodSchema = z.object({
  year: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
  reason: z.string().min(1, "A reason is required to reopen a period"),
});

const yearEndCloseSchema = z.object({
  fiscalYear: z.number().min(2000).max(2100),
});

// ============= Router =============

export const ledgerRouter = router({
  // ============= General Ledger =============

  getGeneralLedger: protectedProcedure
    .input(generalLedgerOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const { accountId, ...options } = input;
        const result = await ledgerRepository.getGeneralLedger(
          accountId,
          ctx.user.id,
          options
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get general ledger");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve general ledger",
        });
      }
    }),

  // ============= Trial Balance =============

  getTrialBalance: protectedProcedure
    .input(trialBalanceOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await ledgerRepository.getTrialBalance(
          ctx.user.id,
          input.asOfDate
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get trial balance");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve trial balance",
        });
      }
    }),

  // ============= Profit & Loss =============

  getProfitAndLoss: protectedProcedure
    .input(profitLossOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await ledgerRepository.getProfitAndLoss(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get profit and loss");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve profit and loss statement",
        });
      }
    }),

  getProfitAndLossComparative: protectedProcedure
    .input(profitLossComparativeOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await ledgerRepository.getProfitAndLossComparative(
          ctx.user.id,
          input.currentPeriod,
          input.comparePeriod
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get comparative P&L");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve comparative profit and loss",
        });
      }
    }),

  // ============= Balance Sheet =============

  getBalanceSheet: protectedProcedure
    .input(balanceSheetOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await ledgerRepository.getBalanceSheet(
          ctx.user.id,
          input.asOfDate
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get balance sheet");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve balance sheet",
        });
      }
    }),

  getBalanceSheetComparative: protectedProcedure
    .input(balanceSheetComparativeOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await ledgerRepository.getBalanceSheetComparative(
          ctx.user.id,
          input.currentAsOfDate,
          input.compareAsOfDate
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get comparative balance sheet");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve comparative balance sheet",
        });
      }
    }),

  // ============= Transaction Search =============

  searchTransactions: protectedProcedure
    .input(transactionSearchOptionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await ledgerRepository.searchTransactions(
          ctx.user.id,
          input
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to search transactions");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search transactions",
        });
      }
    }),

  // ============= Ledger Maintenance =============

  rebuildLedger: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await ledgerRepository.rebuildLedgerTransactions(ctx.user.id);
      logger.info(
        { userId: ctx.user.id, rebuilt: result.rebuilt },
        "Ledger rebuilt successfully"
      );
      return result;
    } catch (error) {
      logger.error({ error }, "Failed to rebuild ledger");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to rebuild ledger transactions",
      });
    }
  }),

  // ============= Accounting Period Management =============

  getPeriodStatus: protectedProcedure
    .input(periodStatusSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await accountingPeriodRepository.getPeriodStatus(
          ctx.user.id,
          input.year,
          input.month
        );
        return result;
      } catch (error) {
        logger.error({ error, input }, "Failed to get period status");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get period status",
        });
      }
    }),

  listPeriods: protectedProcedure
    .input(z.object({ year: z.number().min(2000).max(2100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const periods = await accountingPeriodRepository.listPeriods(
          ctx.user.id,
          input?.year
        );
        return periods;
      } catch (error) {
        logger.error({ error }, "Failed to list periods");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list accounting periods",
        });
      }
    }),

  getOpenPeriods: protectedProcedure.query(async ({ ctx }) => {
    try {
      const periods = await accountingPeriodRepository.getOpenPeriods(ctx.user.id);
      return periods;
    } catch (error) {
      logger.error({ error }, "Failed to get open periods");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get open periods",
      });
    }
  }),

  canPostToDate: protectedProcedure
    .input(z.object({ date: dateSchema }))
    .query(async ({ ctx, input }) => {
      try {
        const canPost = await accountingPeriodRepository.canPostToDate(
          ctx.user.id,
          input.date
        );
        return { canPost };
      } catch (error) {
        logger.error({ error, input }, "Failed to check posting date");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check posting date",
        });
      }
    }),

  closePeriod: protectedProcedure
    .input(closePeriodSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await accountingPeriodRepository.closePeriod(
          ctx.user.id,
          input.year,
          input.month,
          input.notes
        );

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error ?? "Failed to close period",
          });
        }

        logger.info(
          { userId: ctx.user.id, year: input.year, month: input.month },
          "Period closed successfully"
        );
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error({ error, input }, "Failed to close period");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to close period",
        });
      }
    }),

  reopenPeriod: protectedProcedure
    .input(reopenPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await accountingPeriodRepository.reopenPeriod(
          ctx.user.id,
          input.year,
          input.month,
          input.reason
        );

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error ?? "Failed to reopen period",
          });
        }

        logger.info(
          { userId: ctx.user.id, year: input.year, month: input.month, reason: input.reason },
          "Period reopened"
        );
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error({ error, input }, "Failed to reopen period");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to reopen period",
        });
      }
    }),

  yearEndClose: protectedProcedure
    .input(yearEndCloseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await accountingPeriodRepository.yearEndClose(
          ctx.user.id,
          input.fiscalYear
        );

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error ?? "Failed to complete year-end close",
          });
        }

        logger.info(
          {
            userId: ctx.user.id,
            fiscalYear: input.fiscalYear,
            netIncome: result.netIncome,
            periodsLocked: result.periodsLocked,
          },
          "Year-end close completed"
        );
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error({ error, input }, "Failed to complete year-end close");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete year-end close",
        });
      }
    }),
});

export type LedgerRouter = typeof ledgerRouter;
