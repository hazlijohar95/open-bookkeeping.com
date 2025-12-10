/**
 * Bank Feed Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/bankFeed.ts
 * Handles bank account management, transaction imports, and smart matching
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// ============================================
// ZOD SCHEMAS
// ============================================

const transactionTypeSchema = z.enum(["deposit", "withdrawal"]);
const matchStatusSchema = z.enum(["unmatched", "suggested", "matched", "excluded"]);
const categoryTypeSchema = z.enum(["income", "expense"]);

// Bank Account schemas
const createBankAccountSchema = z.object({
  accountName: z.string().min(1, "Account name is required").max(100),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  currency: z.string().length(3).default("MYR"),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

const updateBankAccountSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  bankName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  currency: z.string().length(3).optional(),
  openingBalance: z.string().optional().nullable(),
  openingBalanceDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Transaction schemas
const createTransactionSchema = z.object({
  bankAccountId: z.string().uuid(),
  transactionDate: z.string(),
  description: z.string().min(1),
  reference: z.string().optional().nullable(),
  amount: z.string(),
  type: transactionTypeSchema,
  balance: z.string().optional().nullable(),
});

const updateMatchSchema = z.object({
  matchStatus: matchStatusSchema,
  matchedInvoiceId: z.string().uuid().optional().nullable(),
  matchedBillId: z.string().uuid().optional().nullable(),
  matchedCustomerId: z.string().uuid().optional().nullable(),
  matchedVendorId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  matchConfidence: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const importTransactionsSchema = z.object({
  bankAccountId: z.string().uuid(),
  fileName: z.string(),
  bankPreset: z.enum(["maybank", "cimb", "public_bank", "rhb", "hong_leong", "custom"]).optional(),
  transactions: z.array(z.object({
    transactionDate: z.string(),
    description: z.string(),
    reference: z.string().optional().nullable(),
    amount: z.string(),
    type: transactionTypeSchema,
    balance: z.string().optional().nullable(),
  })),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: categoryTypeSchema,
  color: z.string().max(7).optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  priority: z.number().min(1).max(1000).optional(),
  conditions: z.object({
    descriptionContains: z.array(z.string()).optional(),
    descriptionPattern: z.string().optional(),
    amountMin: z.number().optional(),
    amountMax: z.number().optional(),
    amountExact: z.number().optional(),
    transactionType: transactionTypeSchema.optional(),
  }),
  action: z.object({
    type: z.enum(["match_customer", "match_vendor", "categorize"]),
    customerId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

const transactionQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  matchStatus: matchStatusSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: transactionTypeSchema.optional(),
});

const applyMatchSchema = z.object({
  transactionId: z.string().uuid(),
  matchType: z.enum(["customer", "vendor", "invoice", "bill", "category"]),
  matchId: z.string().uuid(),
  confidence: z.number().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function calculateNameMatch(description: string, name: string): number {
  const normalizedDesc = normalizeText(description);
  const normalizedName = normalizeText(name);

  if (normalizedDesc.includes(normalizedName)) {
    return 0.9;
  }

  const nameWords = normalizedName.split(" ").filter(w => w.length > 2);
  const descWords = normalizedDesc.split(" ");

  let matchedWords = 0;
  for (const word of nameWords) {
    if (descWords.some(dw => dw.includes(word) || word.includes(dw))) {
      matchedWords++;
    }
  }

  if (nameWords.length > 0) {
    return (matchedWords / nameWords.length) * 0.7;
  }

  return 0;
}

function calculateAmountMatch(transactionAmount: string, documentAmount: string): number {
  const txAmt = Math.abs(parseFloat(transactionAmount));
  const docAmt = Math.abs(parseFloat(documentAmount));

  if (txAmt === docAmt) {
    return 1.0;
  }

  const diff = Math.abs(txAmt - docAmt);
  const tolerance = Math.max(txAmt, docAmt) * 0.01;

  if (diff <= tolerance) {
    return 0.95;
  }

  if (diff <= tolerance * 5) {
    return 0.7;
  }

  return 0;
}

// ============================================
// BANK ACCOUNT ROUTES
// ============================================

// List all bank accounts
app.get("/accounts", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: accounts, error } = await db
    .from("bank_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching accounts:", error);
    return c.json({ error: "Failed to fetch accounts" }, 500);
  }

  return c.json(accounts);
});

// Get single bank account
app.get("/accounts/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid account ID format" }, 400);
  }

  const { data: account, error } = await db
    .from("bank_accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Bank account not found" }, 404);
    }
    return c.json({ error: "Failed to fetch account" }, 500);
  }

  return c.json(account);
});

// Create bank account
app.post("/accounts", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createBankAccountSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  const { data: account, error } = await db
    .from("bank_accounts")
    .insert({
      user_id: user.id,
      account_name: input.accountName,
      bank_name: input.bankName,
      account_number: input.accountNumber,
      currency: input.currency,
      opening_balance: input.openingBalance,
      opening_balance_date: input.openingBalanceDate,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating account:", error);
    return c.json({ error: "Failed to create account" }, 500);
  }

  return c.json(account, 201);
});

// Update bank account
app.patch("/accounts/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid account ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = updateBankAccountSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const input = parseResult.data;
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.accountName !== undefined) updateData.account_name = input.accountName;
  if (input.bankName !== undefined) updateData.bank_name = input.bankName;
  if (input.accountNumber !== undefined) updateData.account_number = input.accountNumber;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.openingBalance !== undefined) updateData.opening_balance = input.openingBalance;
  if (input.openingBalanceDate !== undefined) updateData.opening_balance_date = input.openingBalanceDate;
  if (input.isActive !== undefined) updateData.is_active = input.isActive;

  const { data: account, error } = await db
    .from("bank_accounts")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Bank account not found" }, 404);
    }
    return c.json({ error: "Failed to update account" }, 500);
  }

  return c.json(account);
});

// Delete bank account
app.delete("/accounts/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid account ID format" }, 400);
  }

  const { error } = await db
    .from("bank_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting account:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }

  return c.json({ success: true });
});

// ============================================
// TRANSACTION ROUTES
// ============================================

// List transactions for an account
app.get("/accounts/:accountId/transactions", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const accountId = c.req.param("accountId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(accountId).success) {
    return c.json({ error: "Invalid account ID format" }, 400);
  }

  const queryParams = c.req.query();
  const parseResult = transactionQuerySchema.safeParse(queryParams);

  if (!parseResult.success) {
    return c.json({ error: "Invalid query parameters" }, 400);
  }

  const { limit, offset, matchStatus, startDate, endDate, type } = parseResult.data;

  let query = db
    .from("bank_feed_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("bank_account_id", accountId)
    .order("transaction_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (matchStatus) {
    query = query.eq("match_status", matchStatus);
  }
  if (startDate) {
    query = query.gte("transaction_date", startDate);
  }
  if (endDate) {
    query = query.lte("transaction_date", endDate);
  }
  if (type) {
    query = query.eq("type", type);
  }

  const { data: transactions, error, count } = await query;

  if (error) {
    console.error("Error fetching transactions:", error);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  return c.json({
    data: transactions,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get single transaction
app.get("/transactions/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid transaction ID format" }, 400);
  }

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Transaction not found" }, 404);
    }
    return c.json({ error: "Failed to fetch transaction" }, 500);
  }

  return c.json(transaction);
});

// Get unmatched transactions
app.get("/transactions/unmatched", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const accountId = c.req.query("bankAccountId");

  let query = db
    .from("bank_feed_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("match_status", "unmatched")
    .order("transaction_date", { ascending: false });

  if (accountId) {
    const uuidSchema = z.string().uuid();
    if (uuidSchema.safeParse(accountId).success) {
      query = query.eq("bank_account_id", accountId);
    }
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error("Error fetching unmatched transactions:", error);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  return c.json(transactions);
});

// Create single transaction
app.post("/transactions", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createTransactionSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .insert({
      user_id: user.id,
      bank_account_id: input.bankAccountId,
      transaction_date: input.transactionDate,
      description: input.description,
      reference: input.reference,
      amount: input.amount,
      type: input.type,
      balance: input.balance,
      match_status: "unmatched",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating transaction:", error);
    return c.json({ error: "Failed to create transaction" }, 500);
  }

  return c.json(transaction, 201);
});

// Import transactions (bulk)
app.post("/transactions/import", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = importTransactionsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // Create upload record
  const transactionDates = input.transactions.map(t => new Date(t.transactionDate).getTime());
  const startDate = transactionDates.length > 0
    ? new Date(Math.min(...transactionDates)).toISOString()
    : null;
  const endDate = transactionDates.length > 0
    ? new Date(Math.max(...transactionDates)).toISOString()
    : null;

  const { data: upload, error: uploadError } = await db
    .from("bank_feed_uploads")
    .insert({
      user_id: user.id,
      bank_account_id: input.bankAccountId,
      file_name: input.fileName,
      file_type: "csv",
      bank_preset: input.bankPreset,
      transaction_count: input.transactions.length,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single();

  if (uploadError) {
    console.error("Error creating upload:", uploadError);
    return c.json({ error: "Failed to create upload record" }, 500);
  }

  // Create transactions
  const { data: transactions, error: txError } = await db
    .from("bank_feed_transactions")
    .insert(
      input.transactions.map((t) => ({
        user_id: user.id,
        bank_account_id: input.bankAccountId,
        upload_id: upload.id,
        transaction_date: t.transactionDate,
        description: t.description,
        reference: t.reference,
        amount: t.amount,
        type: t.type,
        balance: t.balance,
        match_status: "unmatched",
      }))
    )
    .select();

  if (txError) {
    console.error("Error importing transactions:", txError);
    return c.json({ error: "Failed to import transactions" }, 500);
  }

  return c.json({
    upload,
    transactionCount: transactions?.length || 0,
  }, 201);
});

// Update transaction match
app.patch("/transactions/:id/match", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid transaction ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = updateMatchSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const input = parseResult.data;

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .update({
      match_status: input.matchStatus,
      matched_invoice_id: input.matchedInvoiceId,
      matched_bill_id: input.matchedBillId,
      matched_customer_id: input.matchedCustomerId,
      matched_vendor_id: input.matchedVendorId,
      category_id: input.categoryId,
      match_confidence: input.matchConfidence,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Transaction not found" }, 404);
    }
    return c.json({ error: "Failed to update match" }, 500);
  }

  return c.json(transaction);
});

// Reconcile transaction
app.post("/transactions/:id/reconcile", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid transaction ID format" }, 400);
  }

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .update({
      is_reconciled: true,
      reconciled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Transaction not found" }, 404);
    }
    return c.json({ error: "Failed to reconcile transaction" }, 500);
  }

  return c.json(transaction);
});

// Accept suggestion
app.post("/transactions/:id/accept-suggestion", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .update({
      match_status: "matched",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("match_status", "suggested")
    .select()
    .single();

  if (error) {
    return c.json({ error: "Transaction not found or not in suggested state" }, 404);
  }

  return c.json(transaction);
});

// Reject suggestion
app.post("/transactions/:id/reject-suggestion", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .update({
      match_status: "unmatched",
      matched_customer_id: null,
      matched_vendor_id: null,
      matched_invoice_id: null,
      matched_bill_id: null,
      match_confidence: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  return c.json(transaction);
});

// ============================================
// CATEGORIES ROUTES
// ============================================

// List categories
app.get("/categories", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: categories, error } = await db
    .from("bank_feed_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    return c.json({ error: "Failed to fetch categories" }, 500);
  }

  return c.json(categories);
});

// Create category
app.post("/categories", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createCategorySchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const input = parseResult.data;

  const { data: category, error } = await db
    .from("bank_feed_categories")
    .insert({
      user_id: user.id,
      name: input.name,
      type: input.type,
      color: input.color,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: "Failed to create category" }, 500);
  }

  return c.json(category, 201);
});

// ============================================
// MATCHING RULES ROUTES
// ============================================

// List rules
app.get("/rules", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: rules, error } = await db
    .from("bank_feed_matching_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  if (error) {
    return c.json({ error: "Failed to fetch rules" }, 500);
  }

  return c.json(rules);
});

// Create rule
app.post("/rules", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createRuleSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const input = parseResult.data;

  const { data: rule, error } = await db
    .from("bank_feed_matching_rules")
    .insert({
      user_id: user.id,
      name: input.name,
      priority: input.priority || 100,
      conditions: input.conditions,
      action: input.action,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: "Failed to create rule" }, 500);
  }

  return c.json(rule, 201);
});

// Delete rule
app.delete("/rules/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const { error } = await db
    .from("bank_feed_matching_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return c.json({ error: "Failed to delete rule" }, 500);
  }

  return c.json({ success: true });
});

// ============================================
// STATISTICS ROUTES
// ============================================

// Get transaction stats
app.get("/stats", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const accountId = c.req.query("bankAccountId");

  let query = db
    .from("bank_feed_transactions")
    .select("match_status, type, amount, is_reconciled")
    .eq("user_id", user.id);

  if (accountId) {
    const uuidSchema = z.string().uuid();
    if (uuidSchema.safeParse(accountId).success) {
      query = query.eq("bank_account_id", accountId);
    }
  }

  const { data: transactions, error } = await query;

  if (error) {
    return c.json({ error: "Failed to fetch stats" }, 500);
  }

  const stats = {
    total: transactions?.length || 0,
    unmatched: 0,
    suggested: 0,
    matched: 0,
    excluded: 0,
    reconciled: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    depositCount: 0,
    withdrawalCount: 0,
  };

  (transactions || []).forEach((t) => {
    if (t.match_status === "unmatched") stats.unmatched++;
    if (t.match_status === "suggested") stats.suggested++;
    if (t.match_status === "matched") stats.matched++;
    if (t.match_status === "excluded") stats.excluded++;
    if (t.is_reconciled) stats.reconciled++;

    const amount = Math.abs(parseFloat(t.amount || "0"));
    if (t.type === "deposit") {
      stats.totalDeposits += amount;
      stats.depositCount++;
    } else {
      stats.totalWithdrawals += amount;
      stats.withdrawalCount++;
    }
  });

  return c.json(stats);
});

// ============================================
// SMART MATCHING ROUTES
// ============================================

// Get match suggestions for a transaction
app.get("/transactions/:id/suggestions", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Get the transaction
  const { data: transaction, error: txError } = await db
    .from("bank_feed_transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (txError || !transaction) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  const suggestions: Array<{
    type: string;
    id: string;
    name: string;
    confidence: number;
    reason: string;
    matchedAmount?: string;
  }> = [];

  const isDeposit = transaction.type === "deposit";

  if (isDeposit) {
    // Match against customers
    const { data: customers } = await db
      .from("customers")
      .select("id, name")
      .eq("user_id", user.id);

    (customers || []).forEach((customer) => {
      const nameScore = calculateNameMatch(transaction.description, customer.name);
      if (nameScore > 0.3) {
        suggestions.push({
          type: "customer",
          id: customer.id,
          name: customer.name,
          confidence: nameScore,
          reason: "Customer name appears in description",
        });
      }
    });

    // Match against unpaid invoices
    const { data: invoices } = await db
      .from("invoices")
      .select(`
        id,
        customer_id,
        invoice_fields(items)
      `)
      .eq("user_id", user.id)
      .in("status", ["pending", "sent"])
      .is("deleted_at", null);

    (invoices || []).forEach((invoice) => {
      // Calculate total
      let total = 0;
      const items = invoice.invoice_fields?.items || [];
      items.forEach((item: { quantity: number; unitPrice: string }) => {
        total += (item.quantity || 0) * parseFloat(item.unitPrice || "0");
      });

      const amountScore = calculateAmountMatch(transaction.amount, total.toFixed(2));

      if (amountScore > 0.7) {
        suggestions.push({
          type: "invoice",
          id: invoice.id,
          name: `Invoice - ${total.toFixed(2)}`,
          confidence: amountScore,
          reason: amountScore > 0.9 ? "Amount matches exactly" : "Amount is close",
          matchedAmount: total.toFixed(2),
        });
      }
    });
  } else {
    // Match against vendors
    const { data: vendors } = await db
      .from("vendors")
      .select("id, name")
      .eq("user_id", user.id);

    (vendors || []).forEach((vendor) => {
      const nameScore = calculateNameMatch(transaction.description, vendor.name);
      if (nameScore > 0.3) {
        suggestions.push({
          type: "vendor",
          id: vendor.id,
          name: vendor.name,
          confidence: nameScore,
          reason: "Vendor name appears in description",
        });
      }
    });

    // Match against unpaid bills
    const { data: bills } = await db
      .from("bills")
      .select(`
        id,
        bill_number,
        vendor_id,
        total_amount,
        vendor:vendors(name)
      `)
      .eq("user_id", user.id)
      .in("status", ["pending", "overdue"])
      .is("deleted_at", null);

    (bills || []).forEach((bill) => {
      const amountScore = calculateAmountMatch(transaction.amount, bill.total_amount || "0");
      const vendorName = (bill.vendor as { name: string } | null)?.name || "";

      if (amountScore > 0.7) {
        suggestions.push({
          type: "bill",
          id: bill.id,
          name: `Bill ${bill.bill_number} - ${vendorName}`,
          confidence: amountScore,
          reason: amountScore > 0.9 ? "Amount matches exactly" : "Amount is close",
          matchedAmount: bill.total_amount,
        });
      }
    });
  }

  // Sort by confidence and return top 5
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return c.json(suggestions.slice(0, 5));
});

// Apply match to transaction
app.post("/transactions/apply-match", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = applyMatchSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const { transactionId, matchType, matchId, confidence } = parseResult.data;

  const updateData: Record<string, unknown> = {
    match_status: "matched",
    match_confidence: confidence?.toFixed(2) || null,
    updated_at: new Date().toISOString(),
  };

  if (matchType === "customer") {
    updateData.matched_customer_id = matchId;
  } else if (matchType === "vendor") {
    updateData.matched_vendor_id = matchId;
  } else if (matchType === "invoice") {
    updateData.matched_invoice_id = matchId;
    // Get customer from invoice
    const { data: invoice } = await db
      .from("invoices")
      .select("customer_id")
      .eq("id", matchId)
      .eq("user_id", user.id)
      .single();
    if (invoice?.customer_id) {
      updateData.matched_customer_id = invoice.customer_id;
    }
  } else if (matchType === "bill") {
    updateData.matched_bill_id = matchId;
    // Get vendor from bill
    const { data: bill } = await db
      .from("bills")
      .select("vendor_id")
      .eq("id", matchId)
      .eq("user_id", user.id)
      .single();
    if (bill?.vendor_id) {
      updateData.matched_vendor_id = bill.vendor_id;
    }
  } else if (matchType === "category") {
    updateData.category_id = matchId;
  }

  const { data: transaction, error } = await db
    .from("bank_feed_transactions")
    .update(updateData)
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return c.json({ error: "Failed to apply match" }, 500);
  }

  return c.json(transaction);
});

// Run auto-match on unmatched transactions
app.post("/auto-match", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const accountId = c.req.query("bankAccountId");

  // Get unmatched transactions
  let query = db
    .from("bank_feed_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("match_status", "unmatched");

  if (accountId) {
    const uuidSchema = z.string().uuid();
    if (uuidSchema.safeParse(accountId).success) {
      query = query.eq("bank_account_id", accountId);
    }
  }

  const { data: transactions, error: txError } = await query;

  if (txError) {
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  // Get matching rules
  const { data: rules } = await db
    .from("bank_feed_matching_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("priority", { ascending: true });

  // Get customers and vendors for smart matching
  const { data: customers } = await db
    .from("customers")
    .select("id, name")
    .eq("user_id", user.id);

  const { data: vendors } = await db
    .from("vendors")
    .select("id, name")
    .eq("user_id", user.id);

  let matchedCount = 0;
  let suggestedCount = 0;

  for (const transaction of transactions || []) {
    let matched = false;

    // Try rules first
    for (const rule of rules || []) {
      const conditions = rule.conditions as Record<string, unknown>;
      const action = rule.action as Record<string, unknown>;

      let matches = true;

      // Check description contains
      if (conditions.descriptionContains && Array.isArray(conditions.descriptionContains)) {
        const normalizedDesc = normalizeText(transaction.description);
        matches = conditions.descriptionContains.some((term: string) =>
          normalizedDesc.includes(normalizeText(term))
        );
      }

      // Check amount
      const amount = parseFloat(transaction.amount);
      if (matches && conditions.amountMin != null) {
        matches = amount >= (conditions.amountMin as number);
      }
      if (matches && conditions.amountMax != null) {
        matches = amount <= (conditions.amountMax as number);
      }
      if (matches && conditions.amountExact != null) {
        matches = Math.abs(amount - (conditions.amountExact as number)) < 0.01;
      }

      // Check transaction type
      if (matches && conditions.transactionType) {
        matches = transaction.type === conditions.transactionType;
      }

      if (matches) {
        const updateData: Record<string, unknown> = {
          match_status: "matched",
          match_confidence: "1.00",
          updated_at: new Date().toISOString(),
        };

        if (action.type === "match_customer" && action.customerId) {
          updateData.matched_customer_id = action.customerId;
        } else if (action.type === "match_vendor" && action.vendorId) {
          updateData.matched_vendor_id = action.vendorId;
        } else if (action.type === "categorize" && action.categoryId) {
          updateData.category_id = action.categoryId;
        }

        await db
          .from("bank_feed_transactions")
          .update(updateData)
          .eq("id", transaction.id);

        matchedCount++;
        matched = true;
        break;
      }
    }

    // If no rule matched, try smart matching
    if (!matched) {
      const isDeposit = transaction.type === "deposit";

      if (isDeposit) {
        for (const customer of customers || []) {
          const nameScore = calculateNameMatch(transaction.description, customer.name);
          if (nameScore > 0.6) {
            await db
              .from("bank_feed_transactions")
              .update({
                match_status: "suggested",
                matched_customer_id: customer.id,
                match_confidence: nameScore.toFixed(2),
                updated_at: new Date().toISOString(),
              })
              .eq("id", transaction.id);

            suggestedCount++;
            break;
          }
        }
      } else {
        for (const vendor of vendors || []) {
          const nameScore = calculateNameMatch(transaction.description, vendor.name);
          if (nameScore > 0.6) {
            await db
              .from("bank_feed_transactions")
              .update({
                match_status: "suggested",
                matched_vendor_id: vendor.id,
                match_confidence: nameScore.toFixed(2),
                updated_at: new Date().toISOString(),
              })
              .eq("id", transaction.id);

            suggestedCount++;
            break;
          }
        }
      }
    }
  }

  return c.json({
    matchedCount,
    suggestedCount,
    totalProcessed: transactions?.length || 0,
  });
});

export default app;
