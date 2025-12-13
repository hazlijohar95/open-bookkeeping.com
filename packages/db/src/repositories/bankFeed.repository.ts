import { eq, and, isNull, desc, gte, lte } from "drizzle-orm";
import { db } from "../index";
import {
  bankAccounts,
  bankStatementUploads,
  bankTransactions,
  transactionCategories,
  matchingRules,
  type TransactionType,
  type MatchStatus,
} from "../schema";

// ============= Bank Account =============

export interface CreateBankAccountInput {
  userId: string;
  accountName: string;
  bankName?: string;
  accountNumber?: string;
  currency?: string;
  openingBalance?: string;
  openingBalanceDate?: Date;
}

export interface UpdateBankAccountInput {
  accountName?: string;
  bankName?: string | null;
  accountNumber?: string | null;
  currency?: string;
  openingBalance?: string | null;
  openingBalanceDate?: Date | null;
  isActive?: boolean;
}

// ============= Bank Transactions =============

export interface CreateTransactionInput {
  userId: string;
  bankAccountId: string;
  uploadId?: string | null;
  transactionDate: Date;
  description: string;
  reference?: string | null;
  amount: string;
  type: TransactionType;
  balance?: string | null;
}

export interface UpdateTransactionMatchInput {
  matchStatus: MatchStatus;
  matchedInvoiceId?: string | null;
  matchedBillId?: string | null;
  matchedCustomerId?: string | null;
  matchedVendorId?: string | null;
  categoryId?: string | null;
  matchConfidence?: string | null;
  notes?: string | null;
}

export interface TransactionQueryOptions {
  limit?: number;
  offset?: number;
  matchStatus?: MatchStatus;
  startDate?: Date;
  endDate?: Date;
  type?: TransactionType;
}

export const bankFeedRepository = {
  // ============= Bank Accounts =============

  findAccountById: async (id: string, userId: string) => {
    return db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.userId, userId),
        isNull(bankAccounts.deletedAt)
      ),
    });
  },

  findAllAccounts: async (userId: string) => {
    return db.query.bankAccounts.findMany({
      where: and(
        eq(bankAccounts.userId, userId),
        isNull(bankAccounts.deletedAt)
      ),
      orderBy: [desc(bankAccounts.createdAt)],
    });
  },

  createAccount: async (input: CreateBankAccountInput) => {
    const [account] = await db
      .insert(bankAccounts)
      .values({
        userId: input.userId,
        accountName: input.accountName,
        bankName: input.bankName ?? null,
        accountNumber: input.accountNumber ?? null,
        currency: input.currency ?? "MYR",
        openingBalance: input.openingBalance ?? "0",
        openingBalanceDate: input.openingBalanceDate ?? null,
      })
      .returning();

    return account;
  },

  updateAccount: async (id: string, userId: string, input: UpdateBankAccountInput) => {
    const existing = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.userId, userId),
        isNull(bankAccounts.deletedAt)
      ),
    });

    if (!existing) return null;

    const [updated] = await db
      .update(bankAccounts)
      .set({
        accountName: input.accountName ?? existing.accountName,
        bankName: input.bankName !== undefined ? input.bankName : existing.bankName,
        accountNumber: input.accountNumber !== undefined ? input.accountNumber : existing.accountNumber,
        currency: input.currency ?? existing.currency,
        openingBalance: input.openingBalance !== undefined ? input.openingBalance : existing.openingBalance,
        openingBalanceDate: input.openingBalanceDate !== undefined ? input.openingBalanceDate : existing.openingBalanceDate,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)))
      .returning();

    return updated;
  },

  deleteAccount: async (id: string, userId: string) => {
    const existing = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.userId, userId),
        isNull(bankAccounts.deletedAt)
      ),
    });

    if (!existing) return false;

    await db
      .update(bankAccounts)
      .set({ deletedAt: new Date() })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));

    return true;
  },

  // ============= Statement Uploads =============

  createUpload: async (input: {
    userId: string;
    bankAccountId: string;
    fileName: string;
    fileType: string;
    bankPreset?: string;
    transactionCount?: number;
    startDate?: Date;
    endDate?: Date;
  }) => {
    const [upload] = await db
      .insert(bankStatementUploads)
      .values({
        userId: input.userId,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        fileType: input.fileType,
        bankPreset: input.bankPreset ?? null,
        transactionCount: input.transactionCount ?? null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
      })
      .returning();

    return upload;
  },

  findUploadsByAccount: async (bankAccountId: string, userId: string) => {
    return db.query.bankStatementUploads.findMany({
      where: and(
        eq(bankStatementUploads.bankAccountId, bankAccountId),
        eq(bankStatementUploads.userId, userId)
      ),
      orderBy: [desc(bankStatementUploads.createdAt)],
    });
  },

  // ============= Transactions =============

  createTransaction: async (input: CreateTransactionInput) => {
    const [transaction] = await db
      .insert(bankTransactions)
      .values({
        userId: input.userId,
        bankAccountId: input.bankAccountId,
        uploadId: input.uploadId ?? null,
        transactionDate: input.transactionDate,
        description: input.description,
        reference: input.reference ?? null,
        amount: input.amount,
        type: input.type,
        balance: input.balance ?? null,
        matchStatus: "unmatched",
      })
      .returning();

    return transaction;
  },

  createManyTransactions: async (transactions: CreateTransactionInput[]) => {
    if (!transactions.length) return [];

    const result = await db
      .insert(bankTransactions)
      .values(
        transactions.map((t) => ({
          userId: t.userId,
          bankAccountId: t.bankAccountId,
          uploadId: t.uploadId ?? null,
          transactionDate: t.transactionDate,
          description: t.description,
          reference: t.reference ?? null,
          amount: t.amount,
          type: t.type,
          balance: t.balance ?? null,
          matchStatus: "unmatched" as const,
        }))
      )
      .returning();

    return result;
  },

  /**
   * Check for duplicate transactions
   * Duplicates are identified by: same bank account, same date, same amount, similar description
   */
  findDuplicateTransactions: async (
    bankAccountId: string,
    userId: string,
    transactions: Array<{
      transactionDate: Date;
      amount: string;
      description: string;
      type: "deposit" | "withdrawal";
    }>
  ): Promise<Array<{
    index: number;
    existingId: string;
    existingDate: Date;
    existingDescription: string;
    existingAmount: string;
  }>> => {
    if (!transactions.length) return [];

    // Get existing transactions for the date range
    const dates = transactions.map((t) => t.transactionDate);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Expand range by 1 day to catch edge cases
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);

    const existing = await db.query.bankTransactions.findMany({
      where: and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.userId, userId),
        gte(bankTransactions.transactionDate, minDate),
        lte(bankTransactions.transactionDate, maxDate)
      ),
    });

    const duplicates: Array<{
      index: number;
      existingId: string;
      existingDate: Date;
      existingDescription: string;
      existingAmount: string;
    }> = [];

    // Check each incoming transaction for duplicates
    for (let i = 0; i < transactions.length; i++) {
      const incoming = transactions[i]!;
      const incomingAmount = parseFloat(incoming.amount);
      const incomingDate = incoming.transactionDate.getTime();

      for (const existingTx of existing) {
        const existingAmount = parseFloat(existingTx.amount);
        const existingDate = existingTx.transactionDate.getTime();

        // Check if amounts match (within 0.01 tolerance)
        const amountMatches = Math.abs(incomingAmount - existingAmount) < 0.01;

        // Check if dates match (same day)
        const dateMatches = Math.abs(existingDate - incomingDate) < 24 * 60 * 60 * 1000;

        // Check if descriptions are similar (contains at least 3 words in common)
        const incomingWords = incoming.description.toLowerCase().split(/\s+/);
        const existingWords = existingTx.description.toLowerCase().split(/\s+/);
        const commonWords = incomingWords.filter((w) =>
          w.length > 2 && existingWords.some((ew) => ew.includes(w) || w.includes(ew))
        );
        const descriptionSimilar = commonWords.length >= 2 ||
          incoming.description.toLowerCase() === existingTx.description.toLowerCase();

        // Consider duplicate if amount and date match, AND description is similar
        if (amountMatches && dateMatches && descriptionSimilar) {
          duplicates.push({
            index: i,
            existingId: existingTx.id,
            existingDate: existingTx.transactionDate,
            existingDescription: existingTx.description,
            existingAmount: existingTx.amount,
          });
          break; // Only report first match per incoming transaction
        }
      }
    }

    return duplicates;
  },

  findTransactionById: async (id: string, userId: string) => {
    return db.query.bankTransactions.findFirst({
      where: and(
        eq(bankTransactions.id, id),
        eq(bankTransactions.userId, userId)
      ),
      with: {
        bankAccount: true,
        matchedInvoice: {
          with: {
            invoiceFields: true,
          },
        },
        matchedBill: true,
        matchedCustomer: true,
        matchedVendor: true,
        category: true,
      },
    });
  },

  findTransactionsByAccount: async (
    bankAccountId: string,
    userId: string,
    options?: TransactionQueryOptions
  ) => {
    const { limit = 50, offset = 0, matchStatus, startDate, endDate, type } = options ?? {};

    const conditions = [
      eq(bankTransactions.bankAccountId, bankAccountId),
      eq(bankTransactions.userId, userId),
    ];

    if (matchStatus) {
      conditions.push(eq(bankTransactions.matchStatus, matchStatus));
    }
    if (startDate) {
      conditions.push(gte(bankTransactions.transactionDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(bankTransactions.transactionDate, endDate));
    }
    if (type) {
      conditions.push(eq(bankTransactions.type, type));
    }

    return db.query.bankTransactions.findMany({
      where: and(...conditions),
      with: {
        matchedCustomer: true,
        matchedVendor: true,
        category: true,
      },
      limit,
      offset,
      orderBy: [desc(bankTransactions.transactionDate)],
    });
  },

  findUnmatchedTransactions: async (userId: string, bankAccountId?: string) => {
    const conditions = [
      eq(bankTransactions.userId, userId),
      eq(bankTransactions.matchStatus, "unmatched"),
    ];

    if (bankAccountId) {
      conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
    }

    return db.query.bankTransactions.findMany({
      where: and(...conditions),
      with: {
        bankAccount: true,
      },
      orderBy: [desc(bankTransactions.transactionDate)],
    });
  },

  updateTransactionMatch: async (
    id: string,
    userId: string,
    input: UpdateTransactionMatchInput
  ) => {
    const existing = await db.query.bankTransactions.findFirst({
      where: and(
        eq(bankTransactions.id, id),
        eq(bankTransactions.userId, userId)
      ),
    });

    if (!existing) return null;

    const [updated] = await db
      .update(bankTransactions)
      .set({
        matchStatus: input.matchStatus,
        matchedInvoiceId: input.matchedInvoiceId !== undefined ? input.matchedInvoiceId : existing.matchedInvoiceId,
        matchedBillId: input.matchedBillId !== undefined ? input.matchedBillId : existing.matchedBillId,
        matchedCustomerId: input.matchedCustomerId !== undefined ? input.matchedCustomerId : existing.matchedCustomerId,
        matchedVendorId: input.matchedVendorId !== undefined ? input.matchedVendorId : existing.matchedVendorId,
        categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
        matchConfidence: input.matchConfidence !== undefined ? input.matchConfidence : existing.matchConfidence,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.userId, userId)))
      .returning();

    return updated;
  },

  reconcileTransaction: async (id: string, userId: string) => {
    const [updated] = await db
      .update(bankTransactions)
      .set({
        isReconciled: true,
        reconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(bankTransactions.id, id), eq(bankTransactions.userId, userId)))
      .returning();

    return updated;
  },

  // ============= Categories =============

  findAllCategories: async (userId: string) => {
    return db.query.transactionCategories.findMany({
      where: eq(transactionCategories.userId, userId),
      orderBy: [desc(transactionCategories.createdAt)],
      with: {
        account: true,
      },
    });
  },

  createCategory: async (input: {
    userId: string;
    name: string;
    type: "income" | "expense";
    color?: string;
    accountId?: string;
  }) => {
    const [category] = await db
      .insert(transactionCategories)
      .values({
        userId: input.userId,
        name: input.name,
        type: input.type,
        color: input.color ?? null,
        accountId: input.accountId ?? null,
      })
      .returning();

    return category;
  },

  updateCategory: async (
    id: string,
    userId: string,
    input: {
      name?: string;
      type?: "income" | "expense";
      color?: string | null;
      accountId?: string | null;
    }
  ) => {
    const [category] = await db
      .update(transactionCategories)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.accountId !== undefined && { accountId: input.accountId }),
      })
      .where(
        and(
          eq(transactionCategories.id, id),
          eq(transactionCategories.userId, userId)
        )
      )
      .returning();

    return category;
  },

  // ============= Matching Rules =============

  findAllRules: async (userId: string) => {
    return db.query.matchingRules.findMany({
      where: eq(matchingRules.userId, userId),
      orderBy: [desc(matchingRules.priority)],
    });
  },

  createRule: async (input: {
    userId: string;
    name: string;
    priority?: number;
    conditions: {
      descriptionContains?: string[];
      descriptionPattern?: string;
      amountMin?: number;
      amountMax?: number;
      amountExact?: number;
      transactionType?: "deposit" | "withdrawal";
    };
    action: {
      type: "match_customer" | "match_vendor" | "categorize";
      customerId?: string;
      vendorId?: string;
      categoryId?: string;
    };
  }) => {
    const [rule] = await db
      .insert(matchingRules)
      .values({
        userId: input.userId,
        name: input.name,
        priority: input.priority || 100,
        conditions: input.conditions,
        action: input.action,
      })
      .returning();

    return rule;
  },

  deleteRule: async (id: string, userId: string) => {
    const existing = await db.query.matchingRules.findFirst({
      where: and(
        eq(matchingRules.id, id),
        eq(matchingRules.userId, userId)
      ),
    });

    if (!existing) return false;

    await db
      .delete(matchingRules)
      .where(and(eq(matchingRules.id, id), eq(matchingRules.userId, userId)));

    return true;
  },

  // ============= Statistics =============

  getTransactionStats: async (userId: string, bankAccountId?: string) => {
    const conditions = [eq(bankTransactions.userId, userId)];

    if (bankAccountId) {
      conditions.push(eq(bankTransactions.bankAccountId, bankAccountId));
    }

    const transactions = await db.query.bankTransactions.findMany({
      where: and(...conditions),
    });

    // Calculate deposit/withdrawal stats
    const deposits = transactions.filter((t) => t.type === "deposit");
    const withdrawals = transactions.filter((t) => t.type === "withdrawal");

    const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount ?? "0"), 0);
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount ?? "0")), 0);

    const stats = {
      total: transactions.length,
      unmatched: transactions.filter((t) => t.matchStatus === "unmatched").length,
      suggested: transactions.filter((t) => t.matchStatus === "suggested").length,
      matched: transactions.filter((t) => t.matchStatus === "matched").length,
      excluded: transactions.filter((t) => t.matchStatus === "excluded").length,
      reconciled: transactions.filter((t) => t.isReconciled).length,
      totalDeposits,
      totalWithdrawals,
      depositCount: deposits.length,
      withdrawalCount: withdrawals.length,
    };

    return stats;
  },
};

export type BankFeedRepository = typeof bankFeedRepository;
