/**
 * Ledger REST Routes
 * Provides REST API endpoints for financial reports, ledger operations, and accounting periods
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  ledgerRepository,
  accountingPeriodRepository,
} from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// ============= Schemas =============

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const generalLedgerQuerySchema = z.object({
  accountId: z.string().uuid(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const transactionSearchQuerySchema = z.object({
  query: z.string().min(1),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
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

// ============= Routes =============

export const ledgerRoutes = new Hono();

// ============= General Ledger =============

// GET /general-ledger - Get general ledger for an account
ledgerRoutes.get("/general-ledger", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const parseResult = generalLedgerQuerySchema.safeParse(query);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { accountId, ...options } = parseResult.data;
    const result = await ledgerRepository.getGeneralLedger(accountId, user.id, options);
    return c.json(result);
  } catch (error) {
    console.error("Error fetching general ledger:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve general ledger");
  }
});

// ============= Trial Balance =============

// GET /trial-balance - Get trial balance report
ledgerRoutes.get("/trial-balance", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const asOfDate = c.req.query("asOfDate");
    if (asOfDate && !dateSchema.safeParse(asOfDate).success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD");
    }

    const result = await ledgerRepository.getTrialBalance(user.id, asOfDate ?? undefined);
    return c.json(result);
  } catch (error) {
    console.error("Error fetching trial balance:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve trial balance");
  }
});

// ============= Profit & Loss =============

// GET /profit-loss - Get profit and loss statement
ledgerRoutes.get("/profit-loss", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    if (!startDate || !endDate) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Both startDate and endDate are required");
    }

    if (!dateSchema.safeParse(startDate).success || !dateSchema.safeParse(endDate).success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD");
    }

    const result = await ledgerRepository.getProfitAndLoss(user.id, startDate, endDate);
    return c.json(result);
  } catch (error) {
    console.error("Error fetching profit and loss:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve profit and loss statement");
  }
});

// GET /profit-loss/comparative - Get comparative P&L
ledgerRoutes.get("/profit-loss/comparative", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const currentStartDate = c.req.query("currentStartDate");
    const currentEndDate = c.req.query("currentEndDate");
    const compareStartDate = c.req.query("compareStartDate");
    const compareEndDate = c.req.query("compareEndDate");

    if (!currentStartDate || !currentEndDate || !compareStartDate || !compareEndDate) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "All period dates are required");
    }

    const result = await ledgerRepository.getProfitAndLossComparative(
      user.id,
      { startDate: currentStartDate, endDate: currentEndDate },
      { startDate: compareStartDate, endDate: compareEndDate }
    );
    return c.json(result);
  } catch (error) {
    console.error("Error fetching comparative P&L:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve comparative profit and loss");
  }
});

// ============= Balance Sheet =============

// GET /balance-sheet - Get balance sheet
ledgerRoutes.get("/balance-sheet", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const asOfDate = c.req.query("asOfDate");
    if (asOfDate && !dateSchema.safeParse(asOfDate).success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD");
    }

    // Default to today if no date provided
    const dateToUse = asOfDate || new Date().toISOString().split("T")[0];
    const result = await ledgerRepository.getBalanceSheet(user.id, dateToUse);
    return c.json(result);
  } catch (error) {
    console.error("Error fetching balance sheet:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve balance sheet");
  }
});

// GET /balance-sheet/comparative - Get comparative balance sheet
ledgerRoutes.get("/balance-sheet/comparative", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const currentAsOfDate = c.req.query("currentAsOfDate");
    const compareAsOfDate = c.req.query("compareAsOfDate");

    if (!currentAsOfDate || !compareAsOfDate) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Both currentAsOfDate and compareAsOfDate are required");
    }

    const result = await ledgerRepository.getBalanceSheetComparative(
      user.id,
      currentAsOfDate,
      compareAsOfDate
    );
    return c.json(result);
  } catch (error) {
    console.error("Error fetching comparative balance sheet:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve comparative balance sheet");
  }
});

// ============= Transaction Search =============

// GET /transactions/search - Search transactions
ledgerRoutes.get("/transactions/search", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const parseResult = transactionSearchQuerySchema.safeParse(query);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const result = await ledgerRepository.searchTransactions(user.id, parseResult.data);
    return c.json(result);
  } catch (error) {
    console.error("Error searching transactions:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to search transactions");
  }
});

// ============= Ledger Maintenance =============

// POST /rebuild - Rebuild ledger transactions
ledgerRoutes.post("/rebuild", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const result = await ledgerRepository.rebuildLedgerTransactions(user.id);
    return c.json(result);
  } catch (error) {
    console.error("Error rebuilding ledger:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to rebuild ledger transactions");
  }
});

// ============= Accounting Period Management =============

// GET /periods - List accounting periods
ledgerRoutes.get("/periods", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const yearParam = c.req.query("year");
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    const periods = await accountingPeriodRepository.listPeriods(user.id, year);
    return c.json({ periods });
  } catch (error) {
    console.error("Error listing periods:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to list accounting periods");
  }
});

// GET /periods/open - Get open periods
ledgerRoutes.get("/periods/open", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const periods = await accountingPeriodRepository.getOpenPeriods(user.id);
    return c.json({ periods });
  } catch (error) {
    console.error("Error getting open periods:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to get open periods");
  }
});

// GET /periods/status - Get period status
ledgerRoutes.get("/periods/status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const yearParam = c.req.query("year");
    const monthParam = c.req.query("month");

    if (!yearParam || !monthParam) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Year and month are required");
    }

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid year or month");
    }

    const result = await accountingPeriodRepository.getPeriodStatus(user.id, year, month);
    return c.json(result);
  } catch (error) {
    console.error("Error getting period status:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to get period status");
  }
});

// GET /periods/can-post - Check if can post to date
ledgerRoutes.get("/periods/can-post", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const date = c.req.query("date");
    if (!date) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Date is required");
    }

    if (!dateSchema.safeParse(date).success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid date format. Use YYYY-MM-DD");
    }

    const canPost = await accountingPeriodRepository.canPostToDate(user.id, date);
    return c.json({ canPost });
  } catch (error) {
    console.error("Error checking posting date:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to check posting date");
  }
});

// POST /periods/close - Close accounting period
ledgerRoutes.post("/periods/close", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = closePeriodSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { year, month, notes } = parseResult.data;
    const result = await accountingPeriodRepository.closePeriod(user.id, year, month, notes);

    if (!result.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, result.error ?? "Failed to close period");
    }

    return c.json(result);
  } catch (error) {
    console.error("Error closing period:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to close period");
  }
});

// POST /periods/reopen - Reopen accounting period
ledgerRoutes.post("/periods/reopen", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = reopenPeriodSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { year, month, reason } = parseResult.data;
    const result = await accountingPeriodRepository.reopenPeriod(user.id, year, month, reason);

    if (!result.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, result.error ?? "Failed to reopen period");
    }

    return c.json(result);
  } catch (error) {
    console.error("Error reopening period:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reopen period");
  }
});

// POST /year-end-close - Perform year-end close
ledgerRoutes.post("/year-end-close", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const fiscalYear = body.fiscalYear;

    if (!fiscalYear || typeof fiscalYear !== "number") {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Fiscal year is required");
    }

    const result = await accountingPeriodRepository.yearEndClose(user.id, fiscalYear);

    if (!result.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, result.error ?? "Failed to complete year-end close");
    }

    return c.json(result);
  } catch (error) {
    console.error("Error completing year-end close:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to complete year-end close");
  }
});
