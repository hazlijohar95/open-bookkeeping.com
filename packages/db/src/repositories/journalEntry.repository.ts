import { eq, and, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import {
  accounts,
  journalEntries,
  journalEntryLines,
  accountBalances,
  type JournalEntryStatus,
  type SourceDocumentType,
  type SstTaxCode,
} from "../schema";
import { accountingPeriodRepository } from "./accountingPeriod.repository";
import { ledgerRepository } from "./ledger.repository";

// ============= Types =============

export interface CreateJournalEntryInput {
  userId: string;
  entryDate: string;
  description: string;
  reference?: string;
  sourceType?: SourceDocumentType;
  sourceId?: string;
  lines: JournalEntryLineInput[];
}

export interface JournalEntryLineInput {
  accountId: string;
  debitAmount?: string;
  creditAmount?: string;
  sstTaxCode?: SstTaxCode;
  taxAmount?: string;
  description?: string;
}

export interface JournalEntryQueryOptions {
  status?: JournalEntryStatus;
  startDate?: string;
  endDate?: string;
  sourceType?: SourceDocumentType;
  limit?: number;
  offset?: number;
}

// ============= Repository =============

export const journalEntryRepository = {
  generateEntryNumber: async (userId: string) => {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;

    const lastEntry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.userId, userId),
        sql`${journalEntries.entryNumber} LIKE ${prefix + "%"}`
      ),
      orderBy: [desc(journalEntries.entryNumber)],
    });

    let nextNumber = 1;
    if (lastEntry) {
      const match = lastEntry.entryNumber.match(/JE-\d{4}-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(5, "0")}`;
  },

  create: async (input: CreateJournalEntryInput) => {
    // Validate debits equal credits using Decimal.js for precision
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of input.lines) {
      totalDebit = totalDebit.plus(line.debitAmount ?? "0");
      totalCredit = totalCredit.plus(line.creditAmount ?? "0");
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(
        `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})`
      );
    }

    // Validate all accounts exist and belong to user
    const accountIds = input.lines.map((l) => l.accountId);
    const accountsFound = await db.query.accounts.findMany({
      where: and(
        inArray(accounts.id, accountIds),
        eq(accounts.userId, input.userId),
        sql`${accounts.deletedAt} IS NULL`
      ),
    });

    if (accountsFound.length !== new Set(accountIds).size) {
      throw new Error("One or more accounts not found");
    }

    // Check for header accounts
    const headerAccounts = accountsFound.filter((a) => a.isHeader);
    if (headerAccounts.length > 0) {
      throw new Error(
        `Cannot post to header accounts: ${headerAccounts.map((a) => a.code).join(", ")}`
      );
    }

    const entryNumber = await journalEntryRepository.generateEntryNumber(
      input.userId
    );

    // Create journal entry with audit trail
    const [entry] = await db
      .insert(journalEntries)
      .values({
        userId: input.userId,
        entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        reference: input.reference ?? null,
        status: "draft",
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        totalDebit: totalDebit.toFixed(2),
        totalCredit: totalCredit.toFixed(2),
        createdBy: input.userId, // Audit: who created this entry
      })
      .returning();

    if (!entry) {
      throw new Error("Failed to create journal entry");
    }

    // Create journal entry lines
    for (const [i, line] of input.lines.entries()) {
      await db.insert(journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        lineNumber: i + 1,
        debitAmount: line.debitAmount ?? "0",
        creditAmount: line.creditAmount ?? "0",
        sstTaxCode: line.sstTaxCode ?? null,
        taxAmount: line.taxAmount ?? null,
        description: line.description ?? null,
      });
    }

    return entry;
  },

  findById: async (id: string, userId: string) => {
    return db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.userId, userId)
      ),
      with: {
        lines: {
          with: {
            account: true,
          },
          orderBy: [asc(journalEntryLines.lineNumber)],
        },
      },
    });
  },

  findAll: async (
    userId: string,
    options?: JournalEntryQueryOptions
  ) => {
    const { status, startDate, endDate, sourceType, limit = 50, offset = 0 } =
      options ?? {};

    const conditions = [eq(journalEntries.userId, userId)];

    if (status) {
      conditions.push(eq(journalEntries.status, status));
    }
    if (startDate) {
      conditions.push(gte(journalEntries.entryDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(journalEntries.entryDate, endDate));
    }
    if (sourceType) {
      conditions.push(eq(journalEntries.sourceType, sourceType));
    }

    return db.query.journalEntries.findMany({
      where: and(...conditions),
      with: {
        lines: {
          with: {
            account: true,
          },
          orderBy: [asc(journalEntryLines.lineNumber)],
        },
      },
      orderBy: [desc(journalEntries.entryDate), desc(journalEntries.createdAt)],
      limit,
      offset,
    });
  },

  post: async (id: string, userId: string) => {
    const entry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.userId, userId)
      ),
      with: {
        lines: true,
      },
    });

    if (!entry) {
      throw new Error("Journal entry not found");
    }

    if (entry.status !== "draft") {
      throw new Error("Can only post draft entries");
    }

    // Check if accounting period is open
    const canPost = await accountingPeriodRepository.canPostToDate(
      userId,
      entry.entryDate
    );
    if (!canPost) {
      throw new Error(
        "Cannot post to this date. The accounting period is closed or locked."
      );
    }

    // Update entry status with audit trail
    await db
      .update(journalEntries)
      .set({
        status: "posted",
        postedAt: new Date(),
        postedBy: userId, // Audit: who posted this entry
        updatedBy: userId, // Audit: who last updated
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, id));

    // Update account balances
    const entryDate = new Date(entry.entryDate);
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;

    for (const line of entry.lines) {
      await journalEntryRepository.updateAccountBalance(
        line.accountId,
        year,
        month,
        parseFloat(line.debitAmount),
        parseFloat(line.creditAmount)
      );
    }

    // Sync ledger transactions for fast reporting queries
    await ledgerRepository.updateLedgerTransactions(id, userId);

    return { success: true };
  },

  reverse: async (
    id: string,
    userId: string,
    reversalDate: string
  ) => {
    const original = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.userId, userId)
      ),
      with: {
        lines: true,
      },
    });

    if (!original) {
      throw new Error("Journal entry not found");
    }

    if (original.status !== "posted") {
      throw new Error("Can only reverse posted entries");
    }

    // Create reversal entry (swap debits and credits)
    const reversalLines: JournalEntryLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      debitAmount: line.creditAmount,
      creditAmount: line.debitAmount,
      sstTaxCode: line.sstTaxCode ?? undefined,
      taxAmount: line.taxAmount ?? undefined,
      description: line.description ?? undefined,
    }));

    const reversalEntry = await journalEntryRepository.create({
      userId,
      entryDate: reversalDate,
      description: `Reversal of ${original.entryNumber}: ${original.description}`,
      reference: original.reference ?? undefined,
      lines: reversalLines,
    });

    // Link reversal to original with audit trail
    await db
      .update(journalEntries)
      .set({
        reversedEntryId: original.id,
        updatedBy: userId, // Audit: who last updated
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, reversalEntry.id));

    // Mark original as reversed with audit trail
    await db
      .update(journalEntries)
      .set({
        status: "reversed",
        updatedBy: userId, // Audit: who last updated
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, id));

    // Post the reversal
    await journalEntryRepository.post(reversalEntry.id, userId);

    return reversalEntry;
  },

  // ============= Balance Operations =============

  updateAccountBalance: async (
    accountId: string,
    year: number,
    month: number,
    debitAmount: number,
    creditAmount: number
  ) => {
    // Fetch account to get normalBalance for correct calculation
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    // Helper function to calculate closing balance based on account's normal balance
    // Using Decimal.js for precision
    const calculateClosingBalance = (
      opening: Decimal,
      debits: Decimal,
      credits: Decimal
    ): Decimal => {
      // Credit-normal accounts (liabilities, equity, revenue): balance increases with credits
      // Debit-normal accounts (assets, expenses): balance increases with debits
      if (account?.normalBalance === "credit") {
        return opening.plus(credits).minus(debits);
      }
      return opening.plus(debits).minus(credits);
    };

    // Get or create balance record
    const existing = await db.query.accountBalances.findFirst({
      where: and(
        eq(accountBalances.accountId, accountId),
        eq(accountBalances.year, year),
        eq(accountBalances.month, month)
      ),
    });

    const debitDecimal = new Decimal(debitAmount);
    const creditDecimal = new Decimal(creditAmount);

    if (existing) {
      // Update existing balance using Decimal for precision
      const newDebit = new Decimal(existing.periodDebit).plus(debitDecimal);
      const newCredit = new Decimal(existing.periodCredit).plus(creditDecimal);
      const newClosing = calculateClosingBalance(
        new Decimal(existing.openingBalance),
        newDebit,
        newCredit
      );

      await db
        .update(accountBalances)
        .set({
          periodDebit: newDebit.toFixed(2),
          periodCredit: newCredit.toFixed(2),
          closingBalance: newClosing.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(accountBalances.id, existing.id));
    } else {
      // Get previous month's closing balance
      let openingBalance = new Decimal(0);

      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const prevBalance = await db.query.accountBalances.findFirst({
        where: and(
          eq(accountBalances.accountId, accountId),
          eq(accountBalances.year, prevYear),
          eq(accountBalances.month, prevMonth)
        ),
      });

      if (prevBalance) {
        openingBalance = new Decimal(prevBalance.closingBalance);
      } else {
        // Check account opening balance
        if (account?.openingBalance) {
          openingBalance = new Decimal(account.openingBalance);
        }
      }

      const closingBalance = calculateClosingBalance(
        openingBalance,
        debitDecimal,
        creditDecimal
      );

      await db.insert(accountBalances).values({
        accountId,
        year,
        month,
        openingBalance: openingBalance.toFixed(2),
        periodDebit: debitDecimal.toFixed(2),
        periodCredit: creditDecimal.toFixed(2),
        closingBalance: closingBalance.toFixed(2),
      });
    }
  },

  getAccountBalance: async (
    accountId: string,
    userId: string,
    asOfDate?: string
  ) => {
    // Verify account belongs to user
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        sql`${accounts.deletedAt} IS NULL`
      ),
    });

    if (!account) {
      return null;
    }

    // Get all posted journal entry lines for this account
    const lines = await db.query.journalEntryLines.findMany({
      where: eq(journalEntryLines.accountId, accountId),
      with: {
        journalEntry: true,
      },
    });

    // Use Decimal.js for precision
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const openingBalance = new Decimal(account.openingBalance ?? "0");

    // Initialize based on normal balance type
    if (account.normalBalance === "credit") {
      totalCredit = openingBalance;
    } else {
      totalDebit = openingBalance;
    }

    for (const line of lines) {
      if (line.journalEntry.status !== "posted") continue;

      // Compare dates properly (ISO format string comparison works for YYYY-MM-DD)
      if (asOfDate && line.journalEntry.entryDate > asOfDate) continue;

      totalDebit = totalDebit.plus(line.debitAmount);
      totalCredit = totalCredit.plus(line.creditAmount);
    }

    // Calculate balance based on normal balance type
    const balance =
      account.normalBalance === "debit"
        ? totalDebit.minus(totalCredit)
        : totalCredit.minus(totalDebit);

    return {
      accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      balance: balance.toFixed(2),
    };
  },
};

export type JournalEntryRepository = typeof journalEntryRepository;
