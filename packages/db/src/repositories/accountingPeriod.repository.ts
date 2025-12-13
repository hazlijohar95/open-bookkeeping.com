import { eq, and, asc, desc, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import {
  accountingPeriods,
  journalEntries,
  accounts,
  type AccountingPeriodStatus,
} from "../schema";
import { journalEntryRepository } from "./journalEntry.repository";
import { ledgerRepository } from "./ledger.repository";

// Balance tolerance for financial calculations (smallest currency unit)
const BALANCE_TOLERANCE = new Decimal("0.01");

// ============= Types =============

export interface AccountingPeriodInfo {
  id: string;
  year: number;
  month: number;
  status: AccountingPeriodStatus;
  closedAt: Date | null;
  closedBy: string | null;
  reopenedAt: Date | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  notes: string | null;
}

export interface PeriodCloseResult {
  success: boolean;
  periodId: string;
  draftEntriesCount?: number;
  isBalanced?: boolean;
  error?: string;
}

export interface YearEndCloseResult {
  success: boolean;
  closingEntryId?: string;
  netIncome: string;
  periodsLocked: number;
  error?: string;
}

// ============= Repository =============

export const accountingPeriodRepository = {
  // ============= Period Status =============

  getPeriodStatus: async (
    userId: string,
    year: number,
    month: number
  ): Promise<AccountingPeriodInfo | null> => {
    const period = await db.query.accountingPeriods.findFirst({
      where: and(
        eq(accountingPeriods.userId, userId),
        eq(accountingPeriods.year, year),
        eq(accountingPeriods.month, month)
      ),
    });

    if (!period) {
      // Period doesn't exist = implicitly open
      return {
        id: "",
        year,
        month,
        status: "open",
        closedAt: null,
        closedBy: null,
        reopenedAt: null,
        reopenedBy: null,
        reopenReason: null,
        notes: null,
      };
    }

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      status: period.status,
      closedAt: period.closedAt,
      closedBy: period.closedBy,
      reopenedAt: period.reopenedAt,
      reopenedBy: period.reopenedBy,
      reopenReason: period.reopenReason,
      notes: period.notes,
    };
  },

  listPeriods: async (
    userId: string,
    year?: number
  ): Promise<AccountingPeriodInfo[]> => {
    const conditions = [eq(accountingPeriods.userId, userId)];
    if (year) {
      conditions.push(eq(accountingPeriods.year, year));
    }

    const periods = await db.query.accountingPeriods.findMany({
      where: and(...conditions),
      orderBy: [desc(accountingPeriods.year), desc(accountingPeriods.month)],
    });

    return periods.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      status: p.status,
      closedAt: p.closedAt,
      closedBy: p.closedBy,
      reopenedAt: p.reopenedAt,
      reopenedBy: p.reopenedBy,
      reopenReason: p.reopenReason,
      notes: p.notes,
    }));
  },

  canPostToDate: async (userId: string, date: string): Promise<boolean> => {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    const period = await db.query.accountingPeriods.findFirst({
      where: and(
        eq(accountingPeriods.userId, userId),
        eq(accountingPeriods.year, year),
        eq(accountingPeriods.month, month)
      ),
    });

    // No period record = open by default
    if (!period) return true;

    // Only "open" status allows posting
    return period.status === "open";
  },

  // ============= Period Closing =============

  closePeriod: async (
    userId: string,
    year: number,
    month: number,
    notes?: string
  ): Promise<PeriodCloseResult> => {
    // Check for draft entries in the period
    const draftEntries = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.userId, userId),
        eq(journalEntries.status, "draft"),
        sql`EXTRACT(YEAR FROM ${journalEntries.entryDate}) = ${year}`,
        sql`EXTRACT(MONTH FROM ${journalEntries.entryDate}) = ${month}`
      ),
    });

    if (draftEntries.length > 0) {
      return {
        success: false,
        periodId: "",
        draftEntriesCount: draftEntries.length,
        error: `Cannot close period with ${draftEntries.length} draft entries. Please post or delete them first.`,
      };
    }

    // Verify trial balance is balanced
    const lastDay = new Date(year, month, 0).getDate();
    const asOfDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
    const trialBalance = await ledgerRepository.getTrialBalance(userId, asOfDate);

    if (!trialBalance.isBalanced) {
      return {
        success: false,
        periodId: "",
        isBalanced: false,
        error: "Trial balance is not balanced. Please investigate discrepancies.",
      };
    }

    // Check if period record exists
    const existing = await db.query.accountingPeriods.findFirst({
      where: and(
        eq(accountingPeriods.userId, userId),
        eq(accountingPeriods.year, year),
        eq(accountingPeriods.month, month)
      ),
    });

    let periodId: string;

    if (existing) {
      // Update existing period
      if (existing.status === "locked") {
        return {
          success: false,
          periodId: existing.id,
          error: "Period is permanently locked and cannot be closed again.",
        };
      }

      await db
        .update(accountingPeriods)
        .set({
          status: "closed",
          closedAt: new Date(),
          closedBy: userId,
          notes: notes || existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(accountingPeriods.id, existing.id));

      periodId = existing.id;
    } else {
      // Create new period record
      const [newPeriod] = await db
        .insert(accountingPeriods)
        .values({
          userId,
          year,
          month,
          status: "closed",
          closedAt: new Date(),
          closedBy: userId,
          notes,
        })
        .returning();

      periodId = newPeriod!.id;
    }

    return {
      success: true,
      periodId,
      isBalanced: true,
    };
  },

  reopenPeriod: async (
    userId: string,
    year: number,
    month: number,
    reason: string
  ): Promise<PeriodCloseResult> => {
    const existing = await db.query.accountingPeriods.findFirst({
      where: and(
        eq(accountingPeriods.userId, userId),
        eq(accountingPeriods.year, year),
        eq(accountingPeriods.month, month)
      ),
    });

    if (!existing) {
      return {
        success: false,
        periodId: "",
        error: "Period not found. It may already be open.",
      };
    }

    if (existing.status === "locked") {
      return {
        success: false,
        periodId: existing.id,
        error: "Period is permanently locked and cannot be reopened.",
      };
    }

    if (existing.status === "open") {
      return {
        success: false,
        periodId: existing.id,
        error: "Period is already open.",
      };
    }

    await db
      .update(accountingPeriods)
      .set({
        status: "open",
        reopenedAt: new Date(),
        reopenedBy: userId,
        reopenReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(accountingPeriods.id, existing.id));

    return {
      success: true,
      periodId: existing.id,
    };
  },

  // ============= Year-End Close =============

  yearEndClose: async (
    userId: string,
    fiscalYear: number
  ): Promise<YearEndCloseResult> => {
    // Calculate net income for the year
    const pnl = await ledgerRepository.getProfitAndLoss(
      userId,
      `${fiscalYear}-01-01`,
      `${fiscalYear}-12-31`
    );
    // Use Decimal.js for precision
    const netIncome = new Decimal(pnl.netProfit);

    // Find retained earnings and current year earnings accounts
    const retainedEarningsAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.code, "3200"), // Retained Earnings
        eq(accounts.isSystemAccount, true)
      ),
    });

    // Try to find Current Year Earnings account or use Retained Earnings
    const currentYearEarningsAccount = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.code, "3300") // Current Year Earnings
      ),
    });

    if (!retainedEarningsAccount) {
      return {
        success: false,
        netIncome: netIncome.toFixed(2),
        periodsLocked: 0,
        error:
          "Retained Earnings account (3200) not found. Please initialize chart of accounts.",
      };
    }

    // If no current year earnings account, use retained earnings for both sides
    const creditAccountId = retainedEarningsAccount.id;
    const debitAccountId =
      currentYearEarningsAccount?.id || retainedEarningsAccount.id;

    // Only create closing entry if there's net income to close (using tolerance)
    let closingEntryId: string | undefined;

    if (netIncome.abs().greaterThan(BALANCE_TOLERANCE)) {
      // Create closing entry
      const closingEntry = await journalEntryRepository.create({
        userId,
        entryDate: `${fiscalYear}-12-31`,
        description: `Year-end closing entry for fiscal year ${fiscalYear}`,
        reference: `YE-${fiscalYear}`,
        sourceType: "manual",
        lines: [
          {
            accountId: debitAccountId,
            debitAmount: netIncome.greaterThan(0) ? netIncome.toFixed(2) : "0",
            creditAmount: netIncome.lessThan(0) ? netIncome.abs().toFixed(2) : "0",
            description: "Close current year earnings to retained earnings",
          },
          {
            accountId: creditAccountId,
            debitAmount: netIncome.lessThan(0) ? netIncome.abs().toFixed(2) : "0",
            creditAmount: netIncome.greaterThan(0) ? netIncome.toFixed(2) : "0",
            description: "Retained earnings adjustment",
          },
        ],
      });

      // Post the closing entry
      await journalEntryRepository.post(closingEntry.id, userId);

      // Update ledger transactions
      await ledgerRepository.updateLedgerTransactions(closingEntry.id, userId);

      closingEntryId = closingEntry.id;
    }

    // Lock all periods for the fiscal year
    let periodsLocked = 0;
    for (let month = 1; month <= 12; month++) {
      const existing = await db.query.accountingPeriods.findFirst({
        where: and(
          eq(accountingPeriods.userId, userId),
          eq(accountingPeriods.year, fiscalYear),
          eq(accountingPeriods.month, month)
        ),
      });

      if (existing) {
        await db
          .update(accountingPeriods)
          .set({
            status: "locked",
            notes: `Locked by year-end close on ${new Date().toISOString()}`,
            updatedAt: new Date(),
          })
          .where(eq(accountingPeriods.id, existing.id));
      } else {
        await db.insert(accountingPeriods).values({
          userId,
          year: fiscalYear,
          month,
          status: "locked",
          closedAt: new Date(),
          closedBy: userId,
          notes: `Locked by year-end close on ${new Date().toISOString()}`,
        });
      }
      periodsLocked++;
    }

    return {
      success: true,
      closingEntryId,
      netIncome: netIncome.toFixed(2),
      periodsLocked,
    };
  },

  // ============= Open Periods =============

  getOpenPeriods: async (userId: string): Promise<AccountingPeriodInfo[]> => {
    const periods = await db.query.accountingPeriods.findMany({
      where: and(
        eq(accountingPeriods.userId, userId),
        eq(accountingPeriods.status, "open")
      ),
      orderBy: [asc(accountingPeriods.year), asc(accountingPeriods.month)],
    });

    return periods.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      status: p.status,
      closedAt: p.closedAt,
      closedBy: p.closedBy,
      reopenedAt: p.reopenedAt,
      reopenedBy: p.reopenedBy,
      reopenReason: p.reopenReason,
      notes: p.notes,
    }));
  },
};

export type AccountingPeriodRepository = typeof accountingPeriodRepository;
