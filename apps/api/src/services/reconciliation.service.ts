/**
 * Reconciliation Service
 * Handles bank transaction reconciliation and auto-generation of journal entries
 */

import {
  db,
  bankTransactions,
  journalEntries,
  journalEntryLines,
  accounts,
  transactionCategories,
} from "@open-bookkeeping/db";
import { eq, and, sql } from "drizzle-orm";
import Decimal from "decimal.js";

interface ReconcileTransactionInput {
  transactionId: string;
  userId: string;
  categoryId?: string;
  matchedInvoiceId?: string;
  matchedBillId?: string;
  bankAccountLedgerId?: string; // The Chart of Accounts entry for this bank account
}

interface ReconcileResult {
  success: boolean;
  journalEntryId?: string;
  error?: string;
}

export class ReconciliationService {
  /**
   * Generate the next journal entry number for a user
   */
  private async getNextEntryNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;

    // Get the highest entry number for this year
    const result = await db.execute(sql`
      SELECT entry_number FROM journal_entries
      WHERE user_id = ${userId}
      AND entry_number LIKE ${prefix + '%'}
      ORDER BY entry_number DESC
      LIMIT 1
    `);

    const rows = result as unknown as { entry_number: string }[];
    if (!rows || rows.length === 0 || !rows[0]) {
      return `${prefix}00001`;
    }

    const lastNumber = rows[0].entry_number;
    const sequence = parseInt(lastNumber.split("-").pop() ?? "0", 10);
    return `${prefix}${String(sequence + 1).padStart(5, "0")}`;
  }

  /**
   * Get default accounts for reconciliation
   * - Bank account (asset) - should be passed in or linked to bank account
   * - Suspense account (for uncategorized transactions)
   */
  private async getDefaultAccounts(userId: string): Promise<{
    suspenseAccountId: string | null;
    accountsReceivableId: string | null;
    accountsPayableId: string | null;
  }> {
    const defaultAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.isSystemAccount, true)
      ),
    });

    return {
      suspenseAccountId: defaultAccounts.find(a => a.code === "2900")?.id ?? null, // Suspense
      accountsReceivableId: defaultAccounts.find(a => a.code === "1200")?.id ?? null, // AR
      accountsPayableId: defaultAccounts.find(a => a.code === "2100")?.id ?? null, // AP
    };
  }

  /**
   * Reconcile a bank transaction and create a journal entry
   */
  async reconcileTransaction(input: ReconcileTransactionInput): Promise<ReconcileResult> {
    const { transactionId, userId, categoryId, matchedInvoiceId, matchedBillId, bankAccountLedgerId } = input;

    try {
      // 1. Get the bank transaction
      const transaction = await db.query.bankTransactions.findFirst({
        where: and(
          eq(bankTransactions.id, transactionId),
          eq(bankTransactions.userId, userId)
        ),
        with: {
          bankAccount: true,
          category: true,
        },
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      if (transaction.isReconciled) {
        return { success: false, error: "Transaction already reconciled" };
      }

      // 2. Determine the offsetting account
      let offsetAccountId: string | null = null;
      let offsetAccountDescription = "";

      // Get default accounts
      const defaultAccounts = await this.getDefaultAccounts(userId);

      if (categoryId) {
        // Get the category's linked account (if any)
        const category = await db.query.transactionCategories.findFirst({
          where: eq(transactionCategories.id, categoryId),
          with: {
            account: true,
          },
        });

        if (category) {
          offsetAccountDescription = category.name;
          // Use linked account if available, otherwise use suspense account
          offsetAccountId = category.accountId ?? defaultAccounts.suspenseAccountId;
        }
      } else if (matchedInvoiceId) {
        // Matched to invoice - use Accounts Receivable
        offsetAccountId = defaultAccounts.accountsReceivableId;
        offsetAccountDescription = "Invoice payment received";
      } else if (matchedBillId) {
        // Matched to bill - use Accounts Payable
        offsetAccountId = defaultAccounts.accountsPayableId;
        offsetAccountDescription = "Bill payment made";
      } else {
        // No category or match - use suspense account
        offsetAccountId = defaultAccounts.suspenseAccountId;
        offsetAccountDescription = "Uncategorized transaction";
      }

      // 3. Get or determine bank account ledger ID
      let bankLedgerAccountId = bankAccountLedgerId;
      if (!bankLedgerAccountId) {
        // Try to find a bank account in chart of accounts
        const bankLedger = await db.query.accounts.findFirst({
          where: and(
            eq(accounts.userId, userId),
            eq(accounts.accountType, "asset"),
            sql`LOWER(name) LIKE ${'%bank%'}`
          ),
        });
        bankLedgerAccountId = bankLedger?.id;
      }

      if (!bankLedgerAccountId) {
        return { success: false, error: "No bank ledger account configured. Please set up a bank account in Chart of Accounts." };
      }

      if (!offsetAccountId) {
        return { success: false, error: "No offsetting account available. Please set up default accounts in Chart of Accounts." };
      }

      // 4. Create the journal entry within a transaction
      const journalEntryId = await db.transaction(async (tx) => {
        const entryNumber = await this.getNextEntryNumber(userId);
        const amount = new Decimal(transaction.amount ?? "0").abs();
        const isDeposit = transaction.type === "deposit";
        const entryDate = transaction.transactionDate.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0]!;

        // Create journal entry
        const [journalEntry] = await tx
          .insert(journalEntries)
          .values({
            userId,
            entryNumber,
            entryDate,
            description: `Bank transaction: ${transaction.description}`,
            reference: transaction.reference ?? undefined,
            status: "posted", // Auto-post reconciliation entries
            sourceType: "bank_transaction",
            sourceId: transactionId,
            totalDebit: amount.toString(),
            totalCredit: amount.toString(),
            postedAt: new Date(),
          })
          .returning();

        if (!journalEntry) {
          throw new Error("Failed to create journal entry");
        }

        // Create journal entry lines
        // For deposits: Debit Bank, Credit Revenue/AR
        // For withdrawals: Debit Expense/AP, Credit Bank
        if (isDeposit) {
          // Debit: Bank Account (asset increases)
          await tx.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: bankLedgerAccountId!,
            lineNumber: 1,
            debitAmount: amount.toString(),
            creditAmount: "0",
            description: `Deposit: ${transaction.description}`,
          });

          // Credit: Revenue/AR/Category account
          await tx.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: offsetAccountId!,
            lineNumber: 2,
            debitAmount: "0",
            creditAmount: amount.toString(),
            description: offsetAccountDescription,
          });
        } else {
          // Debit: Expense/AP/Category account
          await tx.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: offsetAccountId!,
            lineNumber: 1,
            debitAmount: amount.toString(),
            creditAmount: "0",
            description: offsetAccountDescription,
          });

          // Credit: Bank Account (asset decreases)
          await tx.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: bankLedgerAccountId!,
            lineNumber: 2,
            debitAmount: "0",
            creditAmount: amount.toString(),
            description: `Withdrawal: ${transaction.description}`,
          });
        }

        // Update the bank transaction
        await tx
          .update(bankTransactions)
          .set({
            isReconciled: true,
            reconciledAt: new Date(),
            journalEntryId: journalEntry.id,
            matchStatus: "matched",
            categoryId: categoryId ?? undefined,
            matchedInvoiceId: matchedInvoiceId ?? undefined,
            matchedBillId: matchedBillId ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(bankTransactions.id, transactionId));

        return journalEntry.id;
      });

      return {
        success: true,
        journalEntryId,
      };
    } catch (error) {
      console.error("Error reconciling transaction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Undo reconciliation - delete journal entry and reset transaction status
   */
  async undoReconciliation(transactionId: string, userId: string): Promise<ReconcileResult> {
    try {
      const transaction = await db.query.bankTransactions.findFirst({
        where: and(
          eq(bankTransactions.id, transactionId),
          eq(bankTransactions.userId, userId)
        ),
      });

      if (!transaction) {
        return { success: false, error: "Transaction not found" };
      }

      if (!transaction.isReconciled) {
        return { success: false, error: "Transaction is not reconciled" };
      }

      await db.transaction(async (tx) => {
        // Delete the journal entry (lines will cascade delete)
        if (transaction.journalEntryId) {
          await tx
            .delete(journalEntries)
            .where(eq(journalEntries.id, transaction.journalEntryId));
        }

        // Reset the transaction
        await tx
          .update(bankTransactions)
          .set({
            isReconciled: false,
            reconciledAt: null,
            journalEntryId: null,
            matchStatus: "unmatched",
            updatedAt: new Date(),
          })
          .where(eq(bankTransactions.id, transactionId));
      });

      return { success: true };
    } catch (error) {
      console.error("Error undoing reconciliation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

// Export singleton instance
export const reconciliationService = new ReconciliationService();
