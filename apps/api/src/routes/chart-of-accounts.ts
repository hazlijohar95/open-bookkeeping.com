/**
 * Chart of Accounts REST Routes
 * Provides REST API endpoints for chart of accounts, journal entries, and trial balance
 */

import { Hono } from "hono";
import { z } from "zod";
import { chartOfAccountsRepository } from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  paginationQuerySchema,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// ============= Schemas =============

const accountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

const normalBalanceSchema = z.enum(["debit", "credit"]);

const sstTaxCodeSchema = z.enum([
  "sr",
  "zrl",
  "es",
  "os",
  "rs",
  "gs",
  "none",
]);

const journalEntryStatusSchema = z.enum(["draft", "posted", "reversed"]);

const sourceDocumentTypeSchema = z.enum([
  "invoice",
  "bill",
  "bank_transaction",
  "manual",
  "credit_note",
  "debit_note",
]);

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
  parentId: z.string().uuid().optional().nullable(),
  sstTaxCode: sstTaxCodeSchema.optional(),
  isHeader: z.boolean().default(false),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const updateAccountSchema = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Za-z0-9]+$/).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  sstTaxCode: sstTaxCodeSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  isHeader: z.boolean().optional(),
  openingBalance: z.string().optional().nullable(),
  openingBalanceDate: z.string().optional().nullable(),
});

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
  lines: z.array(journalEntryLineSchema).min(2, "Journal entry must have at least 2 lines"),
});

const journalEntryFilterSchema = z.object({
  status: journalEntryStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sourceType: sourceDocumentTypeSchema.optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// ============= Routes =============

export const chartOfAccountsRoutes = new Hono();

// ============= Account Routes =============

// GET /has-accounts - Check if user has any accounts
chartOfAccountsRoutes.get("/has-accounts", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const accounts = await chartOfAccountsRepository.findAllAccounts(user.id, { isActive: true });
    return c.json({ hasAccounts: accounts.length > 0, count: accounts.length });
  } catch (error) {
    console.error("Error checking accounts:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to check accounts");
  }
});

// GET /tree - Get account tree (hierarchical)
chartOfAccountsRoutes.get("/tree", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const accountType = c.req.query("accountType");
    const parsedType = accountType ? accountTypeSchema.safeParse(accountType) : null;
    const tree = await chartOfAccountsRepository.getAccountTree(
      user.id,
      parsedType?.success ? parsedType.data : undefined
    );
    return c.json(tree);
  } catch (error) {
    console.error("Error fetching account tree:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch account tree");
  }
});

// GET /summary - Get account summary by type
chartOfAccountsRoutes.get("/summary", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const summary = await chartOfAccountsRepository.getAccountSummaryByType(user.id);
    return c.json(summary);
  } catch (error) {
    console.error("Error fetching account summary:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch account summary");
  }
});

// GET /search - Search accounts
chartOfAccountsRoutes.get("/search", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query("query") ?? "";
    const excludeHeaders = c.req.query("excludeHeaders") === "true";
    const accountType = c.req.query("accountType");

    const allAccounts = await chartOfAccountsRepository.findAllAccounts(user.id, {
      accountType: accountType ? (accountTypeSchema.parse(accountType) as "asset" | "liability" | "equity" | "revenue" | "expense") : undefined,
      isActive: true,
      isHeader: excludeHeaders ? false : undefined,
    });

    const lowerQuery = query.toLowerCase();
    const filtered = query
      ? allAccounts.filter(
          (a) =>
            a.code.toLowerCase().includes(lowerQuery) ||
            a.name.toLowerCase().includes(lowerQuery)
        )
      : allAccounts;

    return c.json(filtered);
  } catch (error) {
    console.error("Error searching accounts:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to search accounts");
  }
});

// POST /initialize-defaults - Initialize default chart of accounts
chartOfAccountsRoutes.post("/initialize-defaults", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const result = await chartOfAccountsRepository.initializeDefaults(user.id);
    return c.json(result, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already has accounts")) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Default accounts have already been initialized");
    }
    console.error("Error initializing defaults:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to initialize default accounts");
  }
});

// GET /accounts - List all accounts
chartOfAccountsRoutes.get("/accounts", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const accountType = query.accountType ? accountTypeSchema.safeParse(query.accountType) : null;
    const isActive = query.isActive ? query.isActive === "true" : undefined;
    const isHeader = query.isHeader ? query.isHeader === "true" : undefined;

    const accounts = await chartOfAccountsRepository.findAllAccounts(user.id, {
      accountType: accountType?.success ? accountType.data : undefined,
      isActive,
      isHeader,
    });
    return c.json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch accounts");
  }
});

// GET /accounts/:id - Get single account
chartOfAccountsRoutes.get("/accounts/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid account ID format");
  }

  try {
    const account = await chartOfAccountsRepository.findAccountById(id, user.id);
    if (!account) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Account not found");
    }

    const balance = await chartOfAccountsRepository.getAccountBalance(id, user.id);
    return c.json({ ...account, balance: balance?.balance ?? "0" });
  } catch (error) {
    console.error("Error fetching account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch account");
  }
});

// POST /accounts - Create new account
chartOfAccountsRoutes.post("/accounts", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createAccountSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { parentId, ...restData } = parseResult.data;
    const account = await chartOfAccountsRepository.createAccount({
      userId: user.id,
      ...restData,
      parentId: parentId ?? undefined, // Convert null to undefined
    });

    if (!account) {
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create account");
    }

    return c.json(account, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        return errorResponse(c, HTTP_STATUS.CONFLICT, error.message);
      }
      if (error.message.includes("Parent account not found")) {
        return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
      }
    }
    console.error("Error creating account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create account");
  }
});

// PATCH /accounts/:id - Update account
chartOfAccountsRoutes.patch("/accounts/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid account ID format");
  }

  try {
    const body = await c.req.json();
    const parseResult = updateAccountSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const account = await chartOfAccountsRepository.updateAccount(id, user.id, parseResult.data);
    if (!account) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Account not found");
    }

    return c.json(account);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Parent account not found")) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
    }
    console.error("Error updating account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update account");
  }
});

// DELETE /accounts/:id - Delete account
chartOfAccountsRoutes.delete("/accounts/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid account ID format");
  }

  try {
    const result = await chartOfAccountsRepository.deleteAccount(id, user.id);
    if (!result.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, result.error ?? "Failed to delete account");
    }
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete account");
  }
});

// ============= Journal Entry Routes =============

// GET /journal-entries - List journal entries
chartOfAccountsRoutes.get("/journal-entries", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const query = c.req.query();
    const parseResult = journalEntryFilterSchema.safeParse(query);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const entries = await chartOfAccountsRepository.findAllJournalEntries(user.id, parseResult.data);
    return c.json(entries);
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch journal entries");
  }
});

// GET /journal-entries/:id - Get single journal entry
chartOfAccountsRoutes.get("/journal-entries/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid journal entry ID format");
  }

  try {
    const entry = await chartOfAccountsRepository.findJournalEntryById(id, user.id);
    if (!entry) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Journal entry not found");
    }
    return c.json(entry);
  } catch (error) {
    console.error("Error fetching journal entry:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch journal entry");
  }
});

// POST /journal-entries - Create journal entry
chartOfAccountsRoutes.post("/journal-entries", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createJournalEntrySchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const entry = await chartOfAccountsRepository.createJournalEntry({
      userId: user.id,
      ...parseResult.data,
    });

    if (!entry) {
      return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create journal entry");
    }

    return c.json(entry, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("must equal") ||
        error.message.includes("header accounts") ||
        error.message.includes("not found")
      ) {
        return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
      }
    }
    console.error("Error creating journal entry:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create journal entry");
  }
});

// POST /journal-entries/:id/post - Post journal entry
chartOfAccountsRoutes.post("/journal-entries/:id/post", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid journal entry ID format");
  }

  try {
    const result = await chartOfAccountsRepository.postJournalEntry(id, user.id);
    return c.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("Can only post")) {
        return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
      }
    }
    console.error("Error posting journal entry:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to post journal entry");
  }
});

// POST /journal-entries/:id/reverse - Reverse journal entry
chartOfAccountsRoutes.post("/journal-entries/:id/reverse", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const id = c.req.param("id");
  if (!uuidParamSchema.safeParse(id).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid journal entry ID format");
  }

  try {
    const body = await c.req.json();
    const reversalDate = body.reversalDate;
    if (!reversalDate) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Reversal date is required");
    }

    const result = await chartOfAccountsRepository.reverseJournalEntry(id, user.id, reversalDate);
    return c.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found") || error.message.includes("Can only reverse")) {
        return errorResponse(c, HTTP_STATUS.BAD_REQUEST, error.message);
      }
    }
    console.error("Error reversing journal entry:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reverse journal entry");
  }
});

// ============= Balance & Report Routes =============

// GET /account-balance/:accountId - Get account balance
chartOfAccountsRoutes.get("/account-balance/:accountId", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  const accountId = c.req.param("accountId");
  if (!uuidParamSchema.safeParse(accountId).success) {
    return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Invalid account ID format");
  }

  try {
    const asOfDate = c.req.query("asOfDate");
    const balance = await chartOfAccountsRepository.getAccountBalance(accountId, user.id, asOfDate);
    if (!balance) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Account not found");
    }
    return c.json(balance);
  } catch (error) {
    console.error("Error fetching account balance:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch account balance");
  }
});

// GET /trial-balance - Get trial balance report
chartOfAccountsRoutes.get("/trial-balance", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const asOfDate = c.req.query("asOfDate");
    const trialBalance = await chartOfAccountsRepository.getTrialBalance(user.id, asOfDate);
    return c.json(trialBalance);
  } catch (error) {
    console.error("Error fetching trial balance:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch trial balance");
  }
});
