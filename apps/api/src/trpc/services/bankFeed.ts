import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { bankFeedRepository, customerRepository, vendorRepository, invoiceRepository, billRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { journalEntryIntegration } from "../../services/journalEntry.integration";

// Type for match suggestions
interface MatchSuggestion {
  type: "customer" | "vendor" | "invoice" | "bill";
  id: string;
  name: string;
  confidence: number;
  reason: string;
  matchedAmount?: string;
}

// Smart matching helper functions
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function calculateNameMatch(description: string, name: string): number {
  const normalizedDesc = normalizeText(description);
  const normalizedName = normalizeText(name);

  // Exact match
  if (normalizedDesc.includes(normalizedName)) {
    return 0.9;
  }

  // Word-by-word match
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

  // Within 1% tolerance
  const diff = Math.abs(txAmt - docAmt);
  const tolerance = Math.max(txAmt, docAmt) * 0.01;

  if (diff <= tolerance) {
    return 0.95;
  }

  // Within 5% tolerance
  if (diff <= tolerance * 5) {
    return 0.7;
  }

  return 0;
}

const logger = createLogger("bankfeed-service");

// Schema definitions
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
  openingBalanceDate: z.coerce.date().optional(),
});

const updateBankAccountSchema = z.object({
  id: z.string().uuid(),
  accountName: z.string().min(1).max(100).optional(),
  bankName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  currency: z.string().length(3).optional(),
  openingBalance: z.string().optional().nullable(),
  openingBalanceDate: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Transaction schemas
const createTransactionSchema = z.object({
  bankAccountId: z.string().uuid(),
  transactionDate: z.coerce.date(),
  description: z.string().min(1),
  reference: z.string().optional().nullable(),
  amount: z.string(),
  type: transactionTypeSchema,
  balance: z.string().optional().nullable(),
});

const updateMatchSchema = z.object({
  id: z.string().uuid(),
  matchStatus: matchStatusSchema,
  matchedInvoiceId: z.string().uuid().optional().nullable(),
  matchedBillId: z.string().uuid().optional().nullable(),
  matchedCustomerId: z.string().uuid().optional().nullable(),
  matchedVendorId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  matchConfidence: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Import transactions schema (for bulk upload)
const importTransactionsSchema = z.object({
  bankAccountId: z.string().uuid(),
  fileName: z.string(),
  bankPreset: z.enum(["maybank", "cimb", "public_bank", "rhb", "hong_leong", "custom"]).optional(),
  transactions: z.array(z.object({
    transactionDate: z.coerce.date(),
    description: z.string(),
    reference: z.string().optional().nullable(),
    amount: z.string(),
    type: transactionTypeSchema,
    balance: z.string().optional().nullable(),
  })),
});

// Category schema
const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: categoryTypeSchema,
  color: z.string().max(7).optional(),
});

// Matching rule schema
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

// Query options
const transactionQuerySchema = z.object({
  bankAccountId: z.string().uuid(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
  matchStatus: matchStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  type: transactionTypeSchema.optional(),
});

export const bankFeedRouter = router({
  // ============= Bank Accounts =============

  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await bankFeedRepository.findAllAccounts(ctx.user.id);
    logger.debug({ userId: ctx.user.id, count: accounts.length }, "Listed bank accounts");
    return accounts;
  }),

  getAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const account = await bankFeedRepository.findAccountById(input.id, ctx.user.id);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bank account not found" });
      }
      return account;
    }),

  createAccount: protectedProcedure
    .input(createBankAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await bankFeedRepository.createAccount({
        userId: ctx.user.id,
        ...input,
      });
      logger.info({ userId: ctx.user.id, accountId: account?.id }, "Bank account created");
      return account;
    }),

  updateAccount: protectedProcedure
    .input(updateBankAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const updated = await bankFeedRepository.updateAccount(id, ctx.user.id, updateData);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bank account not found" });
      }
      logger.info({ userId: ctx.user.id, accountId: id }, "Bank account updated");
      return updated;
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await bankFeedRepository.deleteAccount(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bank account not found" });
      }
      logger.info({ userId: ctx.user.id, accountId: input.id }, "Bank account deleted");
      return { success: true };
    }),

  // ============= Transactions =============

  listTransactions: protectedProcedure
    .input(transactionQuerySchema)
    .query(async ({ ctx, input }) => {
      const { bankAccountId, ...options } = input;
      const transactions = await bankFeedRepository.findTransactionsByAccount(
        bankAccountId,
        ctx.user.id,
        options
      );
      return transactions;
    }),

  getTransaction: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const transaction = await bankFeedRepository.findTransactionById(input.id, ctx.user.id);
      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }
      return transaction;
    }),

  getUnmatchedTransactions: protectedProcedure
    .input(z.object({ bankAccountId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const transactions = await bankFeedRepository.findUnmatchedTransactions(
        ctx.user.id,
        input?.bankAccountId
      );
      return transactions;
    }),

  createTransaction: protectedProcedure
    .input(createTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const transaction = await bankFeedRepository.createTransaction({
        userId: ctx.user.id,
        ...input,
      });
      logger.info({ userId: ctx.user.id, transactionId: transaction?.id }, "Transaction created");
      return transaction;
    }),

  importTransactions: protectedProcedure
    .input(importTransactionsSchema)
    .mutation(async ({ ctx, input }) => {
      // Create upload record first
      const upload = await bankFeedRepository.createUpload({
        userId: ctx.user.id,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        fileType: "csv",
        bankPreset: input.bankPreset,
        transactionCount: input.transactions.length,
        startDate: input.transactions.length > 0
          ? new Date(Math.min(...input.transactions.map(t => new Date(t.transactionDate).getTime())))
          : undefined,
        endDate: input.transactions.length > 0
          ? new Date(Math.max(...input.transactions.map(t => new Date(t.transactionDate).getTime())))
          : undefined,
      });

      // Create all transactions
      const transactions = await bankFeedRepository.createManyTransactions(
        input.transactions.map((t) => ({
          userId: ctx.user.id,
          bankAccountId: input.bankAccountId,
          uploadId: upload?.id,
          transactionDate: t.transactionDate,
          description: t.description,
          reference: t.reference,
          amount: t.amount,
          type: t.type,
          balance: t.balance,
        }))
      );

      logger.info(
        { userId: ctx.user.id, uploadId: upload?.id, count: transactions.length },
        "Transactions imported"
      );

      return {
        upload,
        transactionCount: transactions.length,
      };
    }),

  updateMatch: protectedProcedure
    .input(updateMatchSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const updated = await bankFeedRepository.updateTransactionMatch(id, ctx.user.id, updateData);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }
      logger.info({ userId: ctx.user.id, transactionId: id, matchStatus: input.matchStatus }, "Transaction match updated");
      return updated;
    }),

  reconcileTransaction: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // First, get the transaction to validate it's matched
      const transaction = await bankFeedRepository.findTransactionById(input.id, ctx.user.id);

      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      // Validate: transaction must be matched before reconciling
      if (transaction.matchStatus !== "matched") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot reconcile transaction with status "${transaction.matchStatus}". Transaction must be matched first.`,
        });
      }

      // Check if already reconciled
      if (transaction.isReconciled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transaction is already reconciled",
        });
      }

      const reconciled = await bankFeedRepository.reconcileTransaction(input.id, ctx.user.id);
      if (!reconciled) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      logger.info({ userId: ctx.user.id, transactionId: input.id }, "Transaction reconciled");

      // Create journal entry for the bank transaction (non-blocking)
      journalEntryIntegration.hasChartOfAccounts(ctx.user.id).then(async (hasAccounts) => {
        if (hasAccounts) {
          // Determine the journal entry based on transaction type and match
          const isDeposit = transaction.type === "deposit";
          const amount = Math.abs(parseFloat(transaction.amount));

          // Get reference for the journal entry
          let reference = transaction.reference || undefined;

          if (transaction.matchedInvoiceId && transaction.matchedInvoice) {
            const invoiceFields = transaction.matchedInvoice.invoiceFields as {
              invoiceDetails?: { serialNumber?: string };
            } | null;
            const serialNumber = invoiceFields?.invoiceDetails?.serialNumber;
            reference = serialNumber;
          } else if (transaction.matchedBillId && transaction.matchedBill) {
            reference = transaction.matchedBill.billNumber || undefined;
          }

          // Create the appropriate journal entry
          if (isDeposit && transaction.matchedInvoiceId) {
            // Invoice payment: already handled by invoice service when status changes
            // But for bank reconciliation, we can create a supplementary entry if needed
            journalEntryIntegration.createPaymentJournalEntry(ctx.user.id, {
              sourceType: "invoice",
              sourceId: transaction.matchedInvoiceId,
              sourceNumber: reference || transaction.id,
              amount,
              date: transaction.transactionDate,
              partyName: transaction.matchedCustomer?.name || "Customer",
            }).then((result) => {
              if (result.success) {
                logger.info({ transactionId: input.id, entryId: result.entryId }, "Journal entry created for bank deposit");
              }
            }).catch((err) => {
              logger.warn({ transactionId: input.id, error: err }, "Failed to create journal entry for bank deposit");
            });
          } else if (!isDeposit && transaction.matchedBillId) {
            // Bill payment
            journalEntryIntegration.createPaymentJournalEntry(ctx.user.id, {
              sourceType: "bill",
              sourceId: transaction.matchedBillId,
              sourceNumber: reference || transaction.id,
              amount,
              date: transaction.transactionDate,
              partyName: transaction.matchedVendor?.name || "Vendor",
            }).then((result) => {
              if (result.success) {
                logger.info({ transactionId: input.id, entryId: result.entryId }, "Journal entry created for bank withdrawal");
              }
            }).catch((err) => {
              logger.warn({ transactionId: input.id, error: err }, "Failed to create journal entry for bank withdrawal");
            });
          }
        }
      }).catch(() => {
        // Silently ignore - chart of accounts not initialized
      });

      return reconciled;
    }),

  reconcileMatched: protectedProcedure
    .input(z.object({ bankAccountId: z.string().uuid().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      // Get all matched transactions
      const transactions = await bankFeedRepository.findTransactionsByAccount(
        input?.bankAccountId || "",
        ctx.user.id,
        { matchStatus: "matched" as const }
      );

      // Only if bankAccountId is not provided, get all matched transactions across accounts
      let allTransactions = transactions;
      if (!input?.bankAccountId) {
        const accounts = await bankFeedRepository.findAllAccounts(ctx.user.id);
        allTransactions = [];
        for (const account of accounts) {
          const accountTransactions = await bankFeedRepository.findTransactionsByAccount(
            account.id,
            ctx.user.id,
            { matchStatus: "matched" as const }
          );
          allTransactions.push(...accountTransactions);
        }
      }

      // Filter only non-reconciled, matched transactions
      const toReconcile = allTransactions.filter((t) => !t.isReconciled && t.matchStatus === "matched");

      // Check if user has chart of accounts for journal entries
      const hasAccounts = await journalEntryIntegration.hasChartOfAccounts(ctx.user.id);

      // Reconcile each transaction and create journal entries
      let count = 0;
      for (const transaction of toReconcile) {
        // Get full transaction details for journal entry
        const fullTransaction = await bankFeedRepository.findTransactionById(transaction.id, ctx.user.id);
        if (!fullTransaction) continue;

        await bankFeedRepository.reconcileTransaction(transaction.id, ctx.user.id);
        count++;

        // Create journal entry (non-blocking, per transaction)
        if (hasAccounts) {
          const isDeposit = fullTransaction.type === "deposit";
          const amount = Math.abs(parseFloat(fullTransaction.amount));

          if (isDeposit && fullTransaction.matchedInvoiceId) {
            const invoiceFields = fullTransaction.matchedInvoice?.invoiceFields as {
              invoiceDetails?: { serialNumber?: string };
            } | null;
            const reference = invoiceFields?.invoiceDetails?.serialNumber || fullTransaction.id;

            journalEntryIntegration.createPaymentJournalEntry(ctx.user.id, {
              sourceType: "invoice",
              sourceId: fullTransaction.matchedInvoiceId,
              sourceNumber: reference,
              amount,
              date: fullTransaction.transactionDate,
              partyName: fullTransaction.matchedCustomer?.name || "Customer",
            }).catch((err) => {
              logger.warn({ transactionId: transaction.id, error: err }, "Failed to create journal entry during batch reconciliation");
            });
          } else if (!isDeposit && fullTransaction.matchedBillId) {
            const reference = fullTransaction.matchedBill?.billNumber || fullTransaction.id;

            journalEntryIntegration.createPaymentJournalEntry(ctx.user.id, {
              sourceType: "bill",
              sourceId: fullTransaction.matchedBillId,
              sourceNumber: reference,
              amount,
              date: fullTransaction.transactionDate,
              partyName: fullTransaction.matchedVendor?.name || "Vendor",
            }).catch((err) => {
              logger.warn({ transactionId: transaction.id, error: err }, "Failed to create journal entry during batch reconciliation");
            });
          }
        }
      }

      logger.info({ userId: ctx.user.id, count }, "Batch reconciliation completed");
      return { reconciledCount: count };
    }),

  acceptSuggestion: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Change status from "suggested" to "matched"
      const updated = await bankFeedRepository.updateTransactionMatch(
        input.id,
        ctx.user.id,
        { matchStatus: "matched" }
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      logger.info({ userId: ctx.user.id, transactionId: input.id }, "Suggestion accepted");
      return updated;
    }),

  rejectSuggestion: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Reset to unmatched and clear any suggested match
      const updated = await bankFeedRepository.updateTransactionMatch(
        input.id,
        ctx.user.id,
        {
          matchStatus: "unmatched",
          matchedCustomerId: null,
          matchedVendorId: null,
          matchedInvoiceId: null,
          matchedBillId: null,
          matchConfidence: null,
        }
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      logger.info({ userId: ctx.user.id, transactionId: input.id }, "Suggestion rejected");
      return updated;
    }),

  // ============= Categories =============

  listCategories: protectedProcedure.query(async ({ ctx }) => {
    return bankFeedRepository.findAllCategories(ctx.user.id);
  }),

  createCategory: protectedProcedure
    .input(createCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const category = await bankFeedRepository.createCategory({
        userId: ctx.user.id,
        ...input,
      });
      logger.info({ userId: ctx.user.id, categoryId: category?.id }, "Category created");
      return category;
    }),

  // ============= Matching Rules =============

  listRules: protectedProcedure.query(async ({ ctx }) => {
    return bankFeedRepository.findAllRules(ctx.user.id);
  }),

  createRule: protectedProcedure
    .input(createRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const rule = await bankFeedRepository.createRule({
        userId: ctx.user.id,
        ...input,
      });
      logger.info({ userId: ctx.user.id, ruleId: rule?.id }, "Matching rule created");
      return rule;
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await bankFeedRepository.deleteRule(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
      }
      logger.info({ userId: ctx.user.id, ruleId: input.id }, "Matching rule deleted");
      return { success: true };
    }),

  // ============= Statistics =============

  getStats: protectedProcedure
    .input(z.object({ bankAccountId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return bankFeedRepository.getTransactionStats(ctx.user.id, input?.bankAccountId);
    }),

  // ============= Smart Matching =============

  getSuggestions: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get the transaction
      const transaction = await bankFeedRepository.findTransactionById(input.transactionId, ctx.user.id);
      if (!transaction) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      const suggestions: MatchSuggestion[] = [];
      const isDeposit = transaction.type === "deposit";

      // For deposits, look for customer matches and unpaid invoices
      if (isDeposit) {
        // Match against customers
        const customers = await customerRepository.findMany(ctx.user.id);
        for (const customer of customers) {
          const nameScore = calculateNameMatch(transaction.description, customer.name);
          if (nameScore > 0.3) {
            suggestions.push({
              type: "customer",
              id: customer.id,
              name: customer.name,
              confidence: nameScore,
              reason: `Customer name appears in description`,
            });
          }
        }

        // Match against unpaid invoices
        const invoices = await invoiceRepository.findMany(ctx.user.id);
        for (const invoice of invoices) {
          // Calculate total from items
          let total = 0;
          const items = invoice.invoiceFields?.items || [];
          for (const item of items) {
            const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(String(item.quantity)) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            total += qty * price;
          }

          const amountScore = calculateAmountMatch(transaction.amount, total.toFixed(2));

          // Get customer name for the invoice
          let customerName = "";
          if (invoice.customerId) {
            const customer = customers.find(c => c.id === invoice.customerId);
            customerName = customer?.name || "";
          }
          const nameScore = calculateNameMatch(transaction.description, customerName);

          // Combine scores
          const combinedScore = amountScore * 0.6 + nameScore * 0.4;
          const invoiceNumber = invoice.invoiceFields?.invoiceDetails
            ? `${invoice.invoiceFields.invoiceDetails.prefix || ""}${invoice.invoiceFields.invoiceDetails.serialNumber || ""}`
            : invoice.id.slice(0, 8);

          if (amountScore > 0.7 || combinedScore > 0.5) {
            suggestions.push({
              type: "invoice",
              id: invoice.id,
              name: `Invoice ${invoiceNumber} - ${customerName || "Unknown"}`,
              confidence: Math.max(amountScore, combinedScore),
              reason: amountScore > 0.9
                ? "Amount matches exactly"
                : amountScore > 0.7
                ? "Amount is close"
                : "Customer name and amount match",
              matchedAmount: total.toFixed(2),
            });
          }
        }
      } else {
        // For withdrawals, look for vendor matches and unpaid bills
        const vendors = await vendorRepository.findMany(ctx.user.id);
        for (const vendor of vendors) {
          const nameScore = calculateNameMatch(transaction.description, vendor.name);
          if (nameScore > 0.3) {
            suggestions.push({
              type: "vendor",
              id: vendor.id,
              name: vendor.name,
              confidence: nameScore,
              reason: `Vendor name appears in description`,
            });
          }
        }

        // Match against unpaid bills
        const bills = await billRepository.findMany(ctx.user.id, { status: "pending" });
        for (const bill of bills) {
          // Calculate total from items
          let total = 0;
          for (const item of bill.items || []) {
            const qty = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unitPrice) || 0;
            total += qty * price;
          }

          const amountScore = calculateAmountMatch(transaction.amount, total.toFixed(2));
          const vendorName = bill.vendor?.name || "";
          const nameScore = calculateNameMatch(transaction.description, vendorName);

          // Combine scores
          const combinedScore = amountScore * 0.6 + nameScore * 0.4;

          if (amountScore > 0.7 || combinedScore > 0.5) {
            suggestions.push({
              type: "bill",
              id: bill.id,
              name: `Bill ${bill.billNumber} - ${vendorName || "Unknown"}`,
              confidence: Math.max(amountScore, combinedScore),
              reason: amountScore > 0.9
                ? "Amount matches exactly"
                : amountScore > 0.7
                ? "Amount is close"
                : "Vendor name and amount match",
              matchedAmount: total.toFixed(2),
            });
          }
        }
      }

      // Sort by confidence and return top suggestions
      suggestions.sort((a, b) => b.confidence - a.confidence);
      return suggestions.slice(0, 5);
    }),

  applyMatch: protectedProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
      matchType: z.enum(["customer", "vendor", "invoice", "bill", "category"]),
      matchId: z.string().uuid(),
      confidence: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { transactionId, matchType, matchId, confidence } = input;

      const updateData: Record<string, unknown> = {
        matchStatus: "matched" as const,
        matchConfidence: confidence ? confidence.toFixed(2) : null,
      };

      if (matchType === "customer") {
        updateData.matchedCustomerId = matchId;
      } else if (matchType === "vendor") {
        updateData.matchedVendorId = matchId;
      } else if (matchType === "invoice") {
        updateData.matchedInvoiceId = matchId;
        // Also get and set the customer from the invoice
        const invoice = await invoiceRepository.findById(matchId, ctx.user.id);
        if (invoice?.customerId) {
          updateData.matchedCustomerId = invoice.customerId;
        }
      } else if (matchType === "bill") {
        updateData.matchedBillId = matchId;
        // Also get and set the vendor from the bill
        const bill = await billRepository.findById(matchId, ctx.user.id);
        if (bill?.vendorId) {
          updateData.matchedVendorId = bill.vendorId;
        }
      } else if (matchType === "category") {
        updateData.categoryId = matchId;
        updateData.matchStatus = "matched";
      }

      const updated = await bankFeedRepository.updateTransactionMatch(
        transactionId,
        ctx.user.id,
        {
          matchStatus: updateData.matchStatus as "matched",
          matchedInvoiceId: updateData.matchedInvoiceId as string | null | undefined,
          matchedBillId: updateData.matchedBillId as string | null | undefined,
          matchedCustomerId: updateData.matchedCustomerId as string | null | undefined,
          matchedVendorId: updateData.matchedVendorId as string | null | undefined,
          categoryId: updateData.categoryId as string | null | undefined,
          matchConfidence: updateData.matchConfidence as string | null | undefined,
        }
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
      }

      logger.info(
        { userId: ctx.user.id, transactionId, matchType, matchId },
        "Match applied to transaction"
      );

      return updated;
    }),

  runAutoMatch: protectedProcedure
    .input(z.object({
      bankAccountId: z.string().uuid().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      // Get all unmatched transactions
      const unmatchedTransactions = await bankFeedRepository.findUnmatchedTransactions(
        ctx.user.id,
        input?.bankAccountId
      );

      // Get matching rules
      const rules = await bankFeedRepository.findAllRules(ctx.user.id);

      let matchedCount = 0;
      let suggestedCount = 0;

      for (const transaction of unmatchedTransactions) {
        // Check rules first
        for (const rule of rules) {
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

          // Check description pattern
          if (matches && conditions.descriptionPattern) {
            try {
              const regex = new RegExp(conditions.descriptionPattern as string, "i");
              matches = regex.test(transaction.description);
            } catch {
              matches = false;
            }
          }

          // Check amount range
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
            // Apply the rule action
            const updateData: Record<string, unknown> = {
              matchStatus: "matched" as const,
              matchConfidence: "1.00",
            };

            if (action.type === "match_customer" && action.customerId) {
              updateData.matchedCustomerId = action.customerId;
            } else if (action.type === "match_vendor" && action.vendorId) {
              updateData.matchedVendorId = action.vendorId;
            } else if (action.type === "categorize" && action.categoryId) {
              updateData.categoryId = action.categoryId;
            }

            await bankFeedRepository.updateTransactionMatch(
              transaction.id,
              ctx.user.id,
              {
                matchStatus: updateData.matchStatus as "matched",
                matchedCustomerId: updateData.matchedCustomerId as string | null | undefined,
                matchedVendorId: updateData.matchedVendorId as string | null | undefined,
                categoryId: updateData.categoryId as string | null | undefined,
                matchConfidence: updateData.matchConfidence as string | null | undefined,
              }
            );

            matchedCount++;
            break; // Rule matched, stop checking other rules
          }
        }

        // If no rule matched, try smart matching
        if (!rules.some((r) => {
          const conditions = r.conditions as Record<string, unknown>;
          if (conditions.descriptionContains && Array.isArray(conditions.descriptionContains)) {
            const normalizedDesc = normalizeText(transaction.description);
            return conditions.descriptionContains.some((term: string) =>
              normalizedDesc.includes(normalizeText(term))
            );
          }
          return false;
        })) {
          // Try to find matches
          const isDeposit = transaction.type === "deposit";

          if (isDeposit) {
            // Check customers
            const customers = await customerRepository.findMany(ctx.user.id);
            for (const customer of customers) {
              const nameScore = calculateNameMatch(transaction.description, customer.name);
              if (nameScore > 0.6) {
                await bankFeedRepository.updateTransactionMatch(
                  transaction.id,
                  ctx.user.id,
                  {
                    matchStatus: "suggested",
                    matchedCustomerId: customer.id,
                    matchConfidence: nameScore.toFixed(2),
                  }
                );
                suggestedCount++;
                break;
              }
            }
          } else {
            // Check vendors
            const vendors = await vendorRepository.findMany(ctx.user.id);
            for (const vendor of vendors) {
              const nameScore = calculateNameMatch(transaction.description, vendor.name);
              if (nameScore > 0.6) {
                await bankFeedRepository.updateTransactionMatch(
                  transaction.id,
                  ctx.user.id,
                  {
                    matchStatus: "suggested",
                    matchedVendorId: vendor.id,
                    matchConfidence: nameScore.toFixed(2),
                  }
                );
                suggestedCount++;
                break;
              }
            }
          }
        }
      }

      logger.info(
        { userId: ctx.user.id, matchedCount, suggestedCount },
        "Auto-matching completed"
      );

      return { matchedCount, suggestedCount, totalProcessed: unmatchedTransactions.length };
    }),
});
