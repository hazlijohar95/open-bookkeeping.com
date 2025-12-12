/**
 * Accounts API v1
 * Chart of Accounts and Journal Entries management
 */

import { Hono } from "hono";
import { z } from "zod";
import { accountRepository, journalEntryRepository } from "@open-bookkeeping/db";
import type { AccountType, NormalBalance } from "@open-bookkeeping/db";
import { getApiKeyUserId } from "../../middleware/api-key-auth";
import {
  success,
  created,
  deleted,
  list,
  notFound,
  badRequest,
  validationError,
  internalError,
  parsePagination,
  validateUuid,
  handleZodError,
} from "../../lib/api-response";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("api-v1-accounts");

// Validation schemas
const accountTypeEnum = z.enum(["asset", "liability", "equity", "revenue", "expense"]);
const normalBalanceEnum = z.enum(["debit", "credit"]);

const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  accountType: accountTypeEnum,
  normalBalance: normalBalanceEnum,
  parentId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  isHeader: z.boolean().optional(),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const updateAccountSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  isHeader: z.boolean().optional(),
  openingBalance: z.string().nullable().optional(),
  openingBalanceDate: z.string().nullable().optional(),
});

const journalEntryLineSchema = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.string().optional(),
  creditAmount: z.string().optional(),
  description: z.string().max(500).optional(),
});

const createJournalEntrySchema = z.object({
  entryDate: z.string(), // YYYY-MM-DD format
  reference: z.string().max(100).optional(),
  description: z.string().max(500),
  lines: z.array(journalEntryLineSchema).min(2),
});

export const accountsRouter = new Hono();

// ============================================
// CHART OF ACCOUNTS ENDPOINTS
// ============================================

/**
 * GET /api/v1/accounts
 * List all accounts with optional type filter
 */
accountsRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const typeParam = c.req.query("type") as AccountType | undefined;
    const activeParam = c.req.query("active");

    const accounts = await accountRepository.findAll(userId, {
      accountType: typeParam,
      isActive: activeParam === undefined ? undefined : activeParam !== "false",
    });

    logger.debug({ userId, count: accounts.length }, "Listed accounts via API");

    // Note: findAll doesn't support pagination, return all results
    const { limit, offset } = parsePagination(c);
    const paginatedAccounts = accounts.slice(offset, offset + limit);
    return list(c, paginatedAccounts, { limit, offset, total: accounts.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list accounts");
    return internalError(c);
  }
});

/**
 * GET /api/v1/accounts/tree
 * Get accounts as hierarchical tree
 */
accountsRouter.get("/tree", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const typeParam = c.req.query("type") as AccountType | undefined;
    const tree = await accountRepository.getTree(userId, typeParam);
    return success(c, tree);
  } catch (error) {
    logger.error({ error }, "Failed to get account tree");
    return internalError(c);
  }
});

/**
 * GET /api/v1/accounts/:id
 * Get a single account by ID
 */
accountsRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "account");
  if (validId instanceof Response) return validId;

  try {
    const account = await accountRepository.findById(id, userId);
    if (!account) {
      return notFound(c, "Account", id);
    }

    return success(c, account);
  } catch (error) {
    logger.error({ error, accountId: id }, "Failed to get account");
    return internalError(c);
  }
});

/**
 * GET /api/v1/accounts/:id/balance
 * Get account balance
 */
accountsRouter.get("/:id/balance", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "account");
  if (validId instanceof Response) return validId;

  try {
    const asOfDate = c.req.query("asOf");
    const balance = await journalEntryRepository.getAccountBalance(id, userId, asOfDate);

    if (balance === null) {
      return notFound(c, "Account", id);
    }

    return success(c, balance);
  } catch (error) {
    logger.error({ error, accountId: id }, "Failed to get account balance");
    return internalError(c);
  }
});

/**
 * POST /api/v1/accounts
 * Create a new account
 */
accountsRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createAccountSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;
    const account = await accountRepository.create({
      userId,
      code: input.code,
      name: input.name,
      accountType: input.accountType as AccountType,
      normalBalance: input.normalBalance as NormalBalance,
      parentId: input.parentId,
      description: input.description,
      isHeader: input.isHeader,
      openingBalance: input.openingBalance,
      openingBalanceDate: input.openingBalanceDate,
    });

    logger.info({ userId, accountId: account?.id }, "Account created via API");
    return created(c, account);
  } catch (error) {
    logger.error({ error }, "Failed to create account");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/accounts/:id
 * Update an existing account
 */
accountsRouter.patch("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "account");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateAccountSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const account = await accountRepository.update(id, userId, parseResult.data);
    if (!account) {
      return notFound(c, "Account", id);
    }

    logger.info({ userId, accountId: id }, "Account updated via API");
    return success(c, account);
  } catch (error) {
    logger.error({ error, accountId: id }, "Failed to update account");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/accounts/:id
 * Delete an account (soft delete)
 */
accountsRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "account");
  if (validId instanceof Response) return validId;

  try {
    const result = await accountRepository.delete(id, userId);
    if (!result.success) {
      if (result.error === "Account not found") {
        return notFound(c, "Account", id);
      }
      return badRequest(c, result.error ?? "Cannot delete account");
    }

    logger.info({ userId, accountId: id }, "Account deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, accountId: id }, "Failed to delete account");
    return internalError(c);
  }
});

// ============================================
// JOURNAL ENTRIES ENDPOINTS
// ============================================

/**
 * GET /api/v1/accounts/journal-entries
 * List journal entries with pagination
 */
accountsRouter.get("/journal-entries", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const status = c.req.query("status") as "draft" | "posted" | "reversed" | undefined;

    const entries = await journalEntryRepository.findAll(userId, {
      limit,
      offset,
      startDate,
      endDate,
      status,
    });

    logger.debug({ userId, count: entries.length }, "Listed journal entries via API");
    return list(c, entries, { limit, offset });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    logger.error({ error }, "Failed to list journal entries");
    return internalError(c);
  }
});

/**
 * GET /api/v1/accounts/journal-entries/:id
 * Get a single journal entry by ID
 */
accountsRouter.get("/journal-entries/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "journal entry");
  if (validId instanceof Response) return validId;

  try {
    const entry = await journalEntryRepository.findById(id, userId);
    if (!entry) {
      return notFound(c, "Journal Entry", id);
    }

    return success(c, entry);
  } catch (error) {
    logger.error({ error, entryId: id }, "Failed to get journal entry");
    return internalError(c);
  }
});

/**
 * POST /api/v1/accounts/journal-entries
 * Create a new journal entry
 */
accountsRouter.post("/journal-entries", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const body = await c.req.json();
    const parseResult = createJournalEntrySchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    // Validate debits = credits
    const totalDebits = input.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount ?? "0"), 0);
    const totalCredits = input.lines.reduce((sum, line) => sum + parseFloat(line.creditAmount ?? "0"), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return badRequest(c, "Journal entry must balance: total debits must equal total credits");
    }

    const entry = await journalEntryRepository.create({
      userId,
      entryDate: input.entryDate,
      reference: input.reference,
      description: input.description,
      lines: input.lines.map((line) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description,
      })),
    });

    logger.info({ userId, entryId: entry?.id }, "Journal entry created via API");
    return created(c, entry);
  } catch (error) {
    logger.error({ error }, "Failed to create journal entry");
    return internalError(c);
  }
});

/**
 * POST /api/v1/accounts/journal-entries/:id/post
 * Post a journal entry (make it permanent)
 */
accountsRouter.post("/journal-entries/:id/post", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "journal entry");
  if (validId instanceof Response) return validId;

  try {
    const result = await journalEntryRepository.post(id, userId);

    logger.info({ userId, entryId: id }, "Journal entry posted via API");
    return success(c, { id, posted: result.success });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return notFound(c, "Journal Entry", id);
      }
      return badRequest(c, error.message);
    }
    logger.error({ error, entryId: id }, "Failed to post journal entry");
    return internalError(c);
  }
});
