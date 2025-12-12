/**
 * Bank Feed REST Routes
 * Provides REST API endpoints for bank account management and transaction reconciliation
 */

import { Hono } from "hono";
import { z } from "zod";
import { bankFeedRepository } from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  handleValidationError,
  requireAuth,
  uuidParamSchema,
} from "../lib/rest-route-factory";

// ============= Schemas =============

const createAccountSchema = z.object({
  accountName: z.string().min(1).max(255),
  bankName: z.string().max(255).optional(),
  accountNumber: z.string().max(50).optional(),
  currency: z.string().length(3).default("MYR"),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const updateAccountSchema = z.object({
  accountName: z.string().min(1).max(255).optional(),
  bankName: z.string().max(255).nullable().optional(),
  accountNumber: z.string().max(50).nullable().optional(),
  currency: z.string().length(3).optional(),
  openingBalance: z.string().nullable().optional(),
  openingBalanceDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const createTransactionSchema = z.object({
  bankAccountId: z.string().uuid(),
  transactionDate: z.string(),
  description: z.string().min(1),
  reference: z.string().optional(),
  amount: z.string(),
  type: z.enum(["deposit", "withdrawal"]),
  balance: z.string().optional(),
});

const importTransactionsSchema = z.object({
  bankAccountId: z.string().uuid(),
  fileName: z.string(),
  bankPreset: z.enum(["maybank", "cimb", "public_bank", "rhb", "hong_leong", "custom"]).optional(),
  transactions: z.array(z.object({
    transactionDate: z.string(),
    description: z.string(),
    reference: z.string().optional(),
    amount: z.string(),
    type: z.enum(["deposit", "withdrawal"]),
    balance: z.string().optional(),
  })),
});

const updateMatchSchema = z.object({
  matchStatus: z.enum(["unmatched", "suggested", "matched", "excluded"]),
  matchedInvoiceId: z.string().uuid().nullable().optional(),
  matchedBillId: z.string().uuid().nullable().optional(),
  matchedCustomerId: z.string().uuid().nullable().optional(),
  matchedVendorId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  matchConfidence: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["income", "expense"]),
  color: z.string().max(20).optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  priority: z.number().optional(),
  conditions: z.object({
    descriptionContains: z.array(z.string()).optional(),
    descriptionPattern: z.string().optional(),
    amountMin: z.number().optional(),
    amountMax: z.number().optional(),
    amountExact: z.number().optional(),
    transactionType: z.enum(["deposit", "withdrawal"]).optional(),
  }),
  action: z.object({
    type: z.enum(["match_customer", "match_vendor", "categorize"]),
    customerId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

const applyMatchSchema = z.object({
  transactionId: z.string().uuid(),
  matchType: z.enum(["customer", "vendor", "invoice", "bill", "category"]),
  matchId: z.string().uuid(),
  confidence: z.number().optional(),
});

// ============= Routes =============

export const bankFeedRoutes = new Hono();

// ============= Bank Accounts =============

// GET /accounts - List all bank accounts
bankFeedRoutes.get("/accounts", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const accounts = await bankFeedRepository.findAllAccounts(user.id);
    return c.json(accounts);
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve bank accounts");
  }
});

// GET /accounts/:id - Get single bank account
bankFeedRoutes.get("/accounts/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const account = await bankFeedRepository.findAccountById(id, user.id);
    if (!account) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bank account not found");
    }

    return c.json(account);
  } catch (error) {
    console.error("Error fetching bank account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve bank account");
  }
});

// POST /accounts - Create bank account
bankFeedRoutes.post("/accounts", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createAccountSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { openingBalanceDate, ...rest } = parseResult.data;
    const account = await bankFeedRepository.createAccount({
      userId: user.id,
      ...rest,
      openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : undefined,
    });

    return c.json(account, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating bank account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create bank account");
  }
});

// PATCH /accounts/:id - Update bank account
bankFeedRoutes.patch("/accounts/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const body = await c.req.json();
    const bodyResult = updateAccountSchema.safeParse(body);
    if (!bodyResult.success) {
      return handleValidationError(c, bodyResult.error);
    }

    const { openingBalanceDate, ...rest } = bodyResult.data;
    const account = await bankFeedRepository.updateAccount(id, user.id, {
      ...rest,
      openingBalanceDate: openingBalanceDate !== undefined
        ? (openingBalanceDate ? new Date(openingBalanceDate) : null)
        : undefined,
    });

    if (!account) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bank account not found");
    }

    return c.json(account);
  } catch (error) {
    console.error("Error updating bank account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update bank account");
  }
});

// DELETE /accounts/:id - Delete bank account
bankFeedRoutes.delete("/accounts/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const deleted = await bankFeedRepository.deleteAccount(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Bank account not found");
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete bank account");
  }
});

// ============= Transactions =============

// GET /accounts/:accountId/transactions - List transactions for an account
bankFeedRoutes.get("/accounts/:accountId/transactions", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const accountId = c.req.param("accountId");
    const parseResult = uuidParamSchema.safeParse({ id: accountId });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const query = c.req.query();
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const matchStatus = query.matchStatus as "unmatched" | "suggested" | "matched" | "excluded" | undefined;
    const type = query.type as "deposit" | "withdrawal" | undefined;
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const transactions = await bankFeedRepository.findTransactionsByAccount(
      accountId,
      user.id,
      { limit, offset, matchStatus, type, startDate, endDate }
    );

    // Get total count for pagination
    const allTransactions = await bankFeedRepository.findTransactionsByAccount(
      accountId,
      user.id,
      { limit: 10000, offset: 0, matchStatus, type, startDate, endDate }
    );

    return c.json({
      data: transactions,
      pagination: {
        total: allTransactions.length,
        limit,
        offset,
        hasMore: offset + transactions.length < allTransactions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve transactions");
  }
});

// GET /transactions/:id - Get single transaction
bankFeedRoutes.get("/transactions/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const transaction = await bankFeedRepository.findTransactionById(id, user.id);
    if (!transaction) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    return c.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve transaction");
  }
});

// GET /transactions/unmatched - Get unmatched transactions
bankFeedRoutes.get("/transactions/unmatched", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const bankAccountId = c.req.query("bankAccountId");
    const transactions = await bankFeedRepository.findUnmatchedTransactions(user.id, bankAccountId);
    return c.json(transactions);
  } catch (error) {
    console.error("Error fetching unmatched transactions:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve unmatched transactions");
  }
});

// POST /transactions - Create single transaction
bankFeedRoutes.post("/transactions", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createTransactionSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { transactionDate, ...rest } = parseResult.data;
    const transaction = await bankFeedRepository.createTransaction({
      userId: user.id,
      ...rest,
      transactionDate: new Date(transactionDate),
    });

    return c.json(transaction, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating transaction:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create transaction");
  }
});

// POST /transactions/import - Import multiple transactions
bankFeedRoutes.post("/transactions/import", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = importTransactionsSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { bankAccountId, fileName, bankPreset, transactions } = parseResult.data;

    // Create upload record
    const dates = transactions.map((t) => new Date(t.transactionDate));
    const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const upload = await bankFeedRepository.createUpload({
      userId: user.id,
      bankAccountId,
      fileName,
      fileType: "csv",
      bankPreset,
      transactionCount: transactions.length,
      startDate,
      endDate,
    });

    // Create transactions
    const createdTransactions = await bankFeedRepository.createManyTransactions(
      transactions.map((t) => ({
        userId: user.id,
        bankAccountId,
        uploadId: upload.id,
        transactionDate: new Date(t.transactionDate),
        description: t.description,
        reference: t.reference ?? null,
        amount: t.amount,
        type: t.type,
        balance: t.balance ?? null,
      }))
    );

    return c.json({
      upload: {
        id: upload.id,
        fileName: upload.fileName,
        transactionCount: upload.transactionCount,
      },
      transactionCount: createdTransactions.length,
    }, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error importing transactions:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to import transactions");
  }
});

// PATCH /transactions/:id/match - Update transaction match
bankFeedRoutes.patch("/transactions/:id/match", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const body = await c.req.json();
    const bodyResult = updateMatchSchema.safeParse(body);
    if (!bodyResult.success) {
      return handleValidationError(c, bodyResult.error);
    }

    const transaction = await bankFeedRepository.updateTransactionMatch(id, user.id, bodyResult.data);
    if (!transaction) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    return c.json(transaction);
  } catch (error) {
    console.error("Error updating transaction match:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update transaction match");
  }
});

// POST /transactions/:id/reconcile - Reconcile transaction
bankFeedRoutes.post("/transactions/:id/reconcile", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const transaction = await bankFeedRepository.reconcileTransaction(id, user.id);
    if (!transaction) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    return c.json(transaction);
  } catch (error) {
    console.error("Error reconciling transaction:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reconcile transaction");
  }
});

// POST /transactions/:id/accept-suggestion - Accept match suggestion
bankFeedRoutes.post("/transactions/:id/accept-suggestion", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    // Accept suggestion by changing status from "suggested" to "matched"
    const existing = await bankFeedRepository.findTransactionById(id, user.id);
    if (!existing) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    if (existing.matchStatus !== "suggested") {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Transaction does not have a pending suggestion");
    }

    const transaction = await bankFeedRepository.updateTransactionMatch(id, user.id, {
      matchStatus: "matched",
    });

    return c.json(transaction);
  } catch (error) {
    console.error("Error accepting suggestion:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to accept suggestion");
  }
});

// POST /transactions/:id/reject-suggestion - Reject match suggestion
bankFeedRoutes.post("/transactions/:id/reject-suggestion", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    // Reject suggestion by changing status back to "unmatched" and clearing matches
    const existing = await bankFeedRepository.findTransactionById(id, user.id);
    if (!existing) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    const transaction = await bankFeedRepository.updateTransactionMatch(id, user.id, {
      matchStatus: "unmatched",
      matchedInvoiceId: null,
      matchedBillId: null,
      matchedCustomerId: null,
      matchedVendorId: null,
      categoryId: null,
      matchConfidence: null,
    });

    return c.json(transaction);
  } catch (error) {
    console.error("Error rejecting suggestion:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reject suggestion");
  }
});

// GET /transactions/:id/suggestions - Get match suggestions for a transaction
bankFeedRoutes.get("/transactions/:id/suggestions", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const transaction = await bankFeedRepository.findTransactionById(id, user.id);
    if (!transaction) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    // For now, return empty suggestions - this would be enhanced with AI matching later
    // The actual matching logic would analyze the transaction description, amount, etc.
    const suggestions: Array<{
      type: "customer" | "vendor" | "invoice" | "bill";
      id: string;
      name: string;
      confidence: number;
      reason: string;
      matchedAmount?: string;
    }> = [];

    return c.json(suggestions);
  } catch (error) {
    console.error("Error getting suggestions:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to get suggestions");
  }
});

// POST /transactions/apply-match - Apply a match to a transaction
bankFeedRoutes.post("/transactions/apply-match", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = applyMatchSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const { transactionId, matchType, matchId, confidence } = parseResult.data;

    const updateData: Parameters<typeof bankFeedRepository.updateTransactionMatch>[2] = {
      matchStatus: "matched",
      matchConfidence: confidence?.toString() ?? null,
    };

    // Set the appropriate match field based on type
    switch (matchType) {
      case "customer":
        updateData.matchedCustomerId = matchId;
        break;
      case "vendor":
        updateData.matchedVendorId = matchId;
        break;
      case "invoice":
        updateData.matchedInvoiceId = matchId;
        break;
      case "bill":
        updateData.matchedBillId = matchId;
        break;
      case "category":
        updateData.categoryId = matchId;
        break;
    }

    const transaction = await bankFeedRepository.updateTransactionMatch(
      transactionId,
      user.id,
      updateData
    );

    if (!transaction) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Transaction not found");
    }

    return c.json(transaction);
  } catch (error) {
    console.error("Error applying match:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to apply match");
  }
});

// ============= Categories =============

// GET /categories - List all categories
bankFeedRoutes.get("/categories", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const categories = await bankFeedRepository.findAllCategories(user.id);
    return c.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve categories");
  }
});

// POST /categories - Create category
bankFeedRoutes.post("/categories", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createCategorySchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const category = await bankFeedRepository.createCategory({
      userId: user.id,
      ...parseResult.data,
    });

    return c.json(category, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating category:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create category");
  }
});

// ============= Matching Rules =============

// GET /rules - List all matching rules
bankFeedRoutes.get("/rules", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const rules = await bankFeedRepository.findAllRules(user.id);
    return c.json(rules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve rules");
  }
});

// POST /rules - Create matching rule
bankFeedRoutes.post("/rules", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const parseResult = createRuleSchema.safeParse(body);
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const rule = await bankFeedRepository.createRule({
      userId: user.id,
      ...parseResult.data,
    });

    return c.json(rule, HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating rule:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create rule");
  }
});

// DELETE /rules/:id - Delete matching rule
bankFeedRoutes.delete("/rules/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const parseResult = uuidParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return handleValidationError(c, parseResult.error);
    }

    const deleted = await bankFeedRepository.deleteRule(id, user.id);
    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Rule not found");
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting rule:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete rule");
  }
});

// ============= Stats & Bulk Operations =============

// GET /stats - Get transaction statistics
bankFeedRoutes.get("/stats", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const bankAccountId = c.req.query("bankAccountId");
    const stats = await bankFeedRepository.getTransactionStats(user.id, bankAccountId);
    return c.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to retrieve stats");
  }
});

// POST /auto-match - Auto-match unmatched transactions
bankFeedRoutes.post("/auto-match", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json().catch(() => ({}));
    const bankAccountId = body?.bankAccountId;

    // Get all unmatched transactions
    const unmatched = await bankFeedRepository.findUnmatchedTransactions(user.id, bankAccountId);

    // Get all matching rules
    const rules = await bankFeedRepository.findAllRules(user.id);

    let matchedCount = 0;
    let suggestedCount = 0;

    // Apply rules to unmatched transactions
    for (const transaction of unmatched) {
      for (const rule of rules) {
        const conditions = rule.conditions as {
          descriptionContains?: string[];
          descriptionPattern?: string;
          amountMin?: number;
          amountMax?: number;
          amountExact?: number;
          transactionType?: "deposit" | "withdrawal";
        };
        const action = rule.action as {
          type: "match_customer" | "match_vendor" | "categorize";
          customerId?: string;
          vendorId?: string;
          categoryId?: string;
        };

        let matches = true;

        // Check description contains
        if (conditions.descriptionContains?.length) {
          const desc = transaction.description.toLowerCase();
          matches = conditions.descriptionContains.some((keyword) =>
            desc.includes(keyword.toLowerCase())
          );
        }

        // Check description pattern
        if (matches && conditions.descriptionPattern) {
          try {
            const regex = new RegExp(conditions.descriptionPattern, "i");
            matches = regex.test(transaction.description);
          } catch {
            matches = false;
          }
        }

        // Check amount
        const amount = Math.abs(parseFloat(transaction.amount ?? "0"));
        if (matches && conditions.amountMin !== undefined) {
          matches = amount >= conditions.amountMin;
        }
        if (matches && conditions.amountMax !== undefined) {
          matches = amount <= conditions.amountMax;
        }
        if (matches && conditions.amountExact !== undefined) {
          matches = Math.abs(amount - conditions.amountExact) < 0.01;
        }

        // Check transaction type
        if (matches && conditions.transactionType) {
          matches = transaction.type === conditions.transactionType;
        }

        if (matches) {
          // Apply the action
          const updateData: Parameters<typeof bankFeedRepository.updateTransactionMatch>[2] = {
            matchStatus: "suggested",
            matchConfidence: "0.8",
          };

          switch (action.type) {
            case "match_customer":
              if (action.customerId) {
                updateData.matchedCustomerId = action.customerId;
              }
              break;
            case "match_vendor":
              if (action.vendorId) {
                updateData.matchedVendorId = action.vendorId;
              }
              break;
            case "categorize":
              if (action.categoryId) {
                updateData.categoryId = action.categoryId;
              }
              break;
          }

          await bankFeedRepository.updateTransactionMatch(transaction.id, user.id, updateData);
          suggestedCount++;
          break; // Stop checking rules for this transaction
        }
      }
    }

    return c.json({
      matchedCount,
      suggestedCount,
      totalProcessed: unmatched.length,
    });
  } catch (error) {
    console.error("Error auto-matching:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to auto-match transactions");
  }
});

// POST /reconcile-matched - Reconcile all matched transactions
bankFeedRoutes.post("/reconcile-matched", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json().catch(() => ({}));
    const bankAccountId = body?.bankAccountId;

    // Get all matched but not reconciled transactions
    const transactions = await bankFeedRepository.findTransactionsByAccount(
      bankAccountId ?? "",
      user.id,
      { matchStatus: "matched", limit: 1000 }
    );

    const unreconciledMatched = bankAccountId
      ? transactions.filter((t) => !t.isReconciled)
      : (await bankFeedRepository.findUnmatchedTransactions(user.id)).filter(
          (t) => t.matchStatus === "matched" && !t.isReconciled
        );

    let reconciledCount = 0;
    for (const transaction of unreconciledMatched) {
      await bankFeedRepository.reconcileTransaction(transaction.id, user.id);
      reconciledCount++;
    }

    return c.json({ reconciledCount });
  } catch (error) {
    console.error("Error reconciling matched:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reconcile matched transactions");
  }
});
