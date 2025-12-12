import { eq, and, asc, desc, gte, lte, isNull, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import {
  accounts,
  journalEntries,
  ledgerTransactions,
  type AccountType,
  type NormalBalance,
  type SourceDocumentType,
} from "../schema";

// ============= Types =============

export interface GeneralLedgerEntry {
  id: string;
  transactionDate: string;
  entryNumber: string;
  description: string | null;
  reference: string | null;
  debitAmount: string;
  creditAmount: string;
  runningBalance: string;
  sourceType: SourceDocumentType | null;
  sourceId: string | null;
}

export interface GeneralLedgerResult {
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    normalBalance: NormalBalance;
  };
  openingBalance: string;
  entries: GeneralLedgerEntry[];
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
  period: { startDate: string; endDate: string };
}

export interface TrialBalanceAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitBalance: string;
  creditBalance: string;
}

export interface TrialBalanceResult {
  asOfDate: string;
  accounts: TrialBalanceAccount[];
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
}

export interface AccountWithBalance {
  id: string;
  code: string;
  name: string;
  balance: string;
}

export interface ProfitLossResult {
  period: { startDate: string; endDate: string };
  revenue: {
    accounts: AccountWithBalance[];
    total: string;
  };
  expenses: {
    costOfGoodsSold: AccountWithBalance[];
    operatingExpenses: AccountWithBalance[];
    otherExpenses: AccountWithBalance[];
    totalCOGS: string;
    totalOperating: string;
    totalOther: string;
    total: string;
  };
  grossProfit: string;
  operatingProfit: string;
  netProfit: string;
}

export interface ProfitLossComparativeResult {
  currentPeriod: ProfitLossResult;
  comparePeriod: ProfitLossResult;
  variance: {
    revenue: string;
    revenuePercent: number;
    grossProfit: string;
    grossProfitPercent: number;
    operatingProfit: string;
    operatingProfitPercent: number;
    netProfit: string;
    netProfitPercent: number;
  };
}

export interface BalanceSheetResult {
  asOfDate: string;
  assets: {
    currentAssets: AccountWithBalance[];
    fixedAssets: AccountWithBalance[];
    totalCurrent: string;
    totalFixed: string;
    total: string;
  };
  liabilities: {
    currentLiabilities: AccountWithBalance[];
    nonCurrentLiabilities: AccountWithBalance[];
    totalCurrent: string;
    totalNonCurrent: string;
    total: string;
  };
  equity: {
    accounts: AccountWithBalance[];
    retainedEarnings: string;
    currentYearEarnings: string;
    total: string;
  };
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
}

export interface BalanceSheetComparativeResult {
  current: BalanceSheetResult;
  compare: BalanceSheetResult;
  variance: {
    totalAssets: string;
    totalAssetsPercent: number;
    totalLiabilities: string;
    totalLiabilitiesPercent: number;
    totalEquity: string;
    totalEquityPercent: number;
  };
}

export interface GeneralLedgerOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// ============= Helper Functions =============

function calculateVariancePercent(current: number, compare: number): number {
  if (compare === 0) return current === 0 ? 0 : 100;
  return ((current - compare) / Math.abs(compare)) * 100;
}

// ============= Repository =============

export const ledgerRepository = {
  // ============= General Ledger =============

  getGeneralLedger: async (
    accountId: string,
    userId: string,
    options?: GeneralLedgerOptions
  ): Promise<GeneralLedgerResult | null> => {
    const { startDate, endDate, limit = 100, offset = 0 } = options ?? {};

    // Get account info
    const account = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt)
      ),
    });

    if (!account) {
      return null;
    }

    // Build conditions for ledger transactions
    const conditions = [
      eq(ledgerTransactions.userId, userId),
      eq(ledgerTransactions.accountId, accountId),
    ];

    if (startDate) {
      conditions.push(gte(ledgerTransactions.transactionDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(ledgerTransactions.transactionDate, endDate));
    }

    // Get ledger transactions
    const transactions = await db.query.ledgerTransactions.findMany({
      where: and(...conditions),
      orderBy: [
        asc(ledgerTransactions.transactionDate),
        asc(ledgerTransactions.createdAt),
      ],
      limit,
      offset,
    });

    // Calculate opening balance (balance before the period)
    let openingBalance = new Decimal(account.openingBalance ?? "0");
    if (startDate) {
      const priorTransactions = await db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.userId, userId),
          eq(ledgerTransactions.accountId, accountId),
          sql`${ledgerTransactions.transactionDate} < ${startDate}`
        ),
      });

      for (const t of priorTransactions) {
        if (account.normalBalance === "debit") {
          openingBalance = openingBalance
            .plus(t.debitAmount)
            .minus(t.creditAmount);
        } else {
          openingBalance = openingBalance
            .plus(t.creditAmount)
            .minus(t.debitAmount);
        }
      }
    }

    // Calculate totals and build entries
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    const entries: GeneralLedgerEntry[] = transactions.map((t) => {
      totalDebits = totalDebits.plus(t.debitAmount);
      totalCredits = totalCredits.plus(t.creditAmount);

      return {
        id: t.id,
        transactionDate: t.transactionDate,
        entryNumber: t.entryNumber,
        description: t.description,
        reference: t.reference,
        debitAmount: t.debitAmount,
        creditAmount: t.creditAmount,
        runningBalance: t.runningBalance,
        sourceType: t.sourceType,
        sourceId: t.sourceId,
      };
    });

    // Calculate closing balance
    let closingBalance = openingBalance;
    if (account.normalBalance === "debit") {
      closingBalance = openingBalance.plus(totalDebits).minus(totalCredits);
    } else {
      closingBalance = openingBalance.plus(totalCredits).minus(totalDebits);
    }

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.accountType,
        normalBalance: account.normalBalance,
      },
      openingBalance: openingBalance.toFixed(2),
      entries,
      closingBalance: closingBalance.toFixed(2),
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      period: {
        startDate: startDate ?? "beginning",
        endDate: endDate || new Date().toISOString().split("T")[0]!,
      },
    };
  },

  // ============= Trial Balance =============

  getTrialBalance: async (
    userId: string,
    asOfDate?: string
  ): Promise<TrialBalanceResult> => {
    const dateStr = asOfDate || new Date().toISOString().split("T")[0]!;

    // Get all non-header accounts
    const allAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
        eq(accounts.isHeader, false)
      ),
      orderBy: [asc(accounts.code)],
    });

    const balances: TrialBalanceAccount[] = [];
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const account of allAccounts) {
      // Calculate balance from ledger transactions up to asOfDate
      const transactions = await db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.userId, userId),
          eq(ledgerTransactions.accountId, account.id),
          lte(ledgerTransactions.transactionDate, dateStr)
        ),
      });

      let balance = new Decimal(account.openingBalance ?? "0");
      for (const t of transactions) {
        if (account.normalBalance === "debit") {
          balance = balance.plus(t.debitAmount).minus(t.creditAmount);
        } else {
          balance = balance.plus(t.creditAmount).minus(t.debitAmount);
        }
      }

      // Skip zero balances
      if (balance.abs().lessThan(0.01)) continue;

      let debitBalance = "0";
      let creditBalance = "0";

      if (balance.greaterThan(0)) {
        if (account.normalBalance === "debit") {
          debitBalance = balance.toFixed(2);
          totalDebits = totalDebits.plus(balance);
        } else {
          creditBalance = balance.toFixed(2);
          totalCredits = totalCredits.plus(balance);
        }
      } else if (balance.lessThan(0)) {
        // Negative balance - contra
        if (account.normalBalance === "debit") {
          creditBalance = balance.abs().toFixed(2);
          totalCredits = totalCredits.plus(balance.abs());
        } else {
          debitBalance = balance.abs().toFixed(2);
          totalDebits = totalDebits.plus(balance.abs());
        }
      }

      balances.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        debitBalance,
        creditBalance,
      });
    }

    return {
      asOfDate: dateStr,
      accounts: balances,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: totalDebits.minus(totalCredits).abs().lessThan(0.01),
    };
  },

  // ============= Profit & Loss =============

  getProfitAndLoss: async (
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ProfitLossResult> => {
    // Get all revenue and expense accounts
    const revenueAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.accountType, "revenue"),
        eq(accounts.isHeader, false),
        isNull(accounts.deletedAt)
      ),
      orderBy: [asc(accounts.code)],
    });

    const expenseAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.accountType, "expense"),
        eq(accounts.isHeader, false),
        isNull(accounts.deletedAt)
      ),
      orderBy: [asc(accounts.code)],
    });

    // Calculate revenue
    const revenueItems: AccountWithBalance[] = [];
    let totalRevenue = new Decimal(0);

    for (const account of revenueAccounts) {
      const transactions = await db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.userId, userId),
          eq(ledgerTransactions.accountId, account.id),
          gte(ledgerTransactions.transactionDate, startDate),
          lte(ledgerTransactions.transactionDate, endDate)
        ),
      });

      let balance = new Decimal(0);
      for (const t of transactions) {
        balance = balance.plus(t.creditAmount).minus(t.debitAmount);
      }

      if (balance.abs().greaterThan(0.01)) {
        revenueItems.push({
          id: account.id,
          code: account.code,
          name: account.name,
          balance: balance.toFixed(2),
        });
        totalRevenue = totalRevenue.plus(balance);
      }
    }

    // Calculate expenses (categorized by account code ranges)
    const cogsItems: AccountWithBalance[] = [];
    const operatingItems: AccountWithBalance[] = [];
    const otherItems: AccountWithBalance[] = [];
    let totalCOGS = new Decimal(0);
    let totalOperating = new Decimal(0);
    let totalOther = new Decimal(0);

    for (const account of expenseAccounts) {
      const transactions = await db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.userId, userId),
          eq(ledgerTransactions.accountId, account.id),
          gte(ledgerTransactions.transactionDate, startDate),
          lte(ledgerTransactions.transactionDate, endDate)
        ),
      });

      let balance = new Decimal(0);
      for (const t of transactions) {
        balance = balance.plus(t.debitAmount).minus(t.creditAmount);
      }

      if (balance.abs().greaterThan(0.01)) {
        const item: AccountWithBalance = {
          id: account.id,
          code: account.code,
          name: account.name,
          balance: balance.toFixed(2),
        };

        // Categorize by account code
        const codeNum = parseInt(account.code, 10);
        if (codeNum >= 5000 && codeNum < 5200) {
          // COGS (5000-5199)
          cogsItems.push(item);
          totalCOGS = totalCOGS.plus(balance);
        } else if (codeNum >= 5200 && codeNum < 5900) {
          // Operating expenses (5200-5899)
          operatingItems.push(item);
          totalOperating = totalOperating.plus(balance);
        } else {
          // Other expenses (5900+)
          otherItems.push(item);
          totalOther = totalOther.plus(balance);
        }
      }
    }

    const totalExpenses = totalCOGS.plus(totalOperating).plus(totalOther);
    const grossProfit = totalRevenue.minus(totalCOGS);
    const operatingProfit = grossProfit.minus(totalOperating);
    const netProfit = operatingProfit.minus(totalOther);

    return {
      period: { startDate, endDate },
      revenue: {
        accounts: revenueItems,
        total: totalRevenue.toFixed(2),
      },
      expenses: {
        costOfGoodsSold: cogsItems,
        operatingExpenses: operatingItems,
        otherExpenses: otherItems,
        totalCOGS: totalCOGS.toFixed(2),
        totalOperating: totalOperating.toFixed(2),
        totalOther: totalOther.toFixed(2),
        total: totalExpenses.toFixed(2),
      },
      grossProfit: grossProfit.toFixed(2),
      operatingProfit: operatingProfit.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  },

  getProfitAndLossComparative: async (
    userId: string,
    currentPeriod: { startDate: string; endDate: string },
    comparePeriod: { startDate: string; endDate: string }
  ): Promise<ProfitLossComparativeResult> => {
    const current = await ledgerRepository.getProfitAndLoss(
      userId,
      currentPeriod.startDate,
      currentPeriod.endDate
    );
    const compare = await ledgerRepository.getProfitAndLoss(
      userId,
      comparePeriod.startDate,
      comparePeriod.endDate
    );

    const currentRevenue = parseFloat(current.revenue.total);
    const compareRevenue = parseFloat(compare.revenue.total);
    const currentGross = parseFloat(current.grossProfit);
    const compareGross = parseFloat(compare.grossProfit);
    const currentOperating = parseFloat(current.operatingProfit);
    const compareOperating = parseFloat(compare.operatingProfit);
    const currentNet = parseFloat(current.netProfit);
    const compareNet = parseFloat(compare.netProfit);

    return {
      currentPeriod: current,
      comparePeriod: compare,
      variance: {
        revenue: (currentRevenue - compareRevenue).toFixed(2),
        revenuePercent: calculateVariancePercent(currentRevenue, compareRevenue),
        grossProfit: (currentGross - compareGross).toFixed(2),
        grossProfitPercent: calculateVariancePercent(currentGross, compareGross),
        operatingProfit: (currentOperating - compareOperating).toFixed(2),
        operatingProfitPercent: calculateVariancePercent(
          currentOperating,
          compareOperating
        ),
        netProfit: (currentNet - compareNet).toFixed(2),
        netProfitPercent: calculateVariancePercent(currentNet, compareNet),
      },
    };
  },

  // ============= Balance Sheet =============

  getBalanceSheet: async (
    userId: string,
    asOfDate: string
  ): Promise<BalanceSheetResult> => {
    const calculateAccountBalance = async (
      account: typeof accounts.$inferSelect
    ): Promise<Decimal> => {
      const transactions = await db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.userId, userId),
          eq(ledgerTransactions.accountId, account.id),
          lte(ledgerTransactions.transactionDate, asOfDate)
        ),
      });

      let balance = new Decimal(account.openingBalance ?? "0");
      for (const t of transactions) {
        if (account.normalBalance === "debit") {
          balance = balance.plus(t.debitAmount).minus(t.creditAmount);
        } else {
          balance = balance.plus(t.creditAmount).minus(t.debitAmount);
        }
      }
      return balance;
    };

    // Get asset accounts
    const assetAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.accountType, "asset"),
        eq(accounts.isHeader, false),
        isNull(accounts.deletedAt)
      ),
      orderBy: [asc(accounts.code)],
    });

    const currentAssets: AccountWithBalance[] = [];
    const fixedAssets: AccountWithBalance[] = [];
    let totalCurrentAssets = new Decimal(0);
    let totalFixedAssets = new Decimal(0);

    for (const account of assetAccounts) {
      const balance = await calculateAccountBalance(account);
      if (balance.abs().lessThan(0.01)) continue;

      const item: AccountWithBalance = {
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance.toFixed(2),
      };

      const codeNum = parseInt(account.code, 10);
      if (codeNum >= 1000 && codeNum < 1500) {
        // Current assets (1000-1499)
        currentAssets.push(item);
        totalCurrentAssets = totalCurrentAssets.plus(balance);
      } else {
        // Fixed assets (1500+)
        fixedAssets.push(item);
        totalFixedAssets = totalFixedAssets.plus(balance);
      }
    }

    // Get liability accounts
    const liabilityAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.accountType, "liability"),
        eq(accounts.isHeader, false),
        isNull(accounts.deletedAt)
      ),
      orderBy: [asc(accounts.code)],
    });

    const currentLiabilities: AccountWithBalance[] = [];
    const nonCurrentLiabilities: AccountWithBalance[] = [];
    let totalCurrentLiabilities = new Decimal(0);
    let totalNonCurrentLiabilities = new Decimal(0);

    for (const account of liabilityAccounts) {
      const balance = await calculateAccountBalance(account);
      if (balance.abs().lessThan(0.01)) continue;

      const item: AccountWithBalance = {
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance.toFixed(2),
      };

      const codeNum = parseInt(account.code, 10);
      if (codeNum >= 2000 && codeNum < 2600) {
        // Current liabilities (2000-2599)
        currentLiabilities.push(item);
        totalCurrentLiabilities = totalCurrentLiabilities.plus(balance);
      } else {
        // Non-current liabilities (2600+)
        nonCurrentLiabilities.push(item);
        totalNonCurrentLiabilities = totalNonCurrentLiabilities.plus(balance);
      }
    }

    // Get equity accounts
    const equityAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.accountType, "equity"),
        eq(accounts.isHeader, false),
        isNull(accounts.deletedAt)
      ),
      orderBy: [asc(accounts.code)],
    });

    const equityItems: AccountWithBalance[] = [];
    let totalEquity = new Decimal(0);

    for (const account of equityAccounts) {
      const balance = await calculateAccountBalance(account);
      if (balance.abs().lessThan(0.01)) continue;

      equityItems.push({
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance.toFixed(2),
      });
      totalEquity = totalEquity.plus(balance);
    }

    // Calculate retained earnings (YTD P&L)
    const yearStart = asOfDate.substring(0, 4) + "-01-01";
    const pnl = await ledgerRepository.getProfitAndLoss(
      userId,
      yearStart,
      asOfDate
    );
    const currentYearEarnings = new Decimal(pnl.netProfit);
    const retainedEarnings = new Decimal(0); // Would need prior year close

    const totalLiabilities = totalCurrentLiabilities.plus(
      totalNonCurrentLiabilities
    );
    const totalEquityFinal = totalEquity
      .plus(retainedEarnings)
      .plus(currentYearEarnings);
    const totalAssets = totalCurrentAssets.plus(totalFixedAssets);
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquityFinal);

    return {
      asOfDate,
      assets: {
        currentAssets,
        fixedAssets,
        totalCurrent: totalCurrentAssets.toFixed(2),
        totalFixed: totalFixedAssets.toFixed(2),
        total: totalAssets.toFixed(2),
      },
      liabilities: {
        currentLiabilities,
        nonCurrentLiabilities,
        totalCurrent: totalCurrentLiabilities.toFixed(2),
        totalNonCurrent: totalNonCurrentLiabilities.toFixed(2),
        total: totalLiabilities.toFixed(2),
      },
      equity: {
        accounts: equityItems,
        retainedEarnings: retainedEarnings.toFixed(2),
        currentYearEarnings: currentYearEarnings.toFixed(2),
        total: totalEquityFinal.toFixed(2),
      },
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
      isBalanced: totalAssets.minus(totalLiabilitiesAndEquity).abs().lessThan(0.01),
    };
  },

  getBalanceSheetComparative: async (
    userId: string,
    currentAsOfDate: string,
    compareAsOfDate: string
  ): Promise<BalanceSheetComparativeResult> => {
    const current = await ledgerRepository.getBalanceSheet(
      userId,
      currentAsOfDate
    );
    const compare = await ledgerRepository.getBalanceSheet(
      userId,
      compareAsOfDate
    );

    const currentAssets = parseFloat(current.assets.total);
    const compareAssets = parseFloat(compare.assets.total);
    const currentLiabilities = parseFloat(current.liabilities.total);
    const compareLiabilities = parseFloat(compare.liabilities.total);
    const currentEquity = parseFloat(current.equity.total);
    const compareEquity = parseFloat(compare.equity.total);

    return {
      current,
      compare,
      variance: {
        totalAssets: (currentAssets - compareAssets).toFixed(2),
        totalAssetsPercent: calculateVariancePercent(currentAssets, compareAssets),
        totalLiabilities: (currentLiabilities - compareLiabilities).toFixed(2),
        totalLiabilitiesPercent: calculateVariancePercent(
          currentLiabilities,
          compareLiabilities
        ),
        totalEquity: (currentEquity - compareEquity).toFixed(2),
        totalEquityPercent: calculateVariancePercent(currentEquity, compareEquity),
      },
    };
  },

  // ============= Ledger Transaction Management =============

  updateLedgerTransactions: async (
    journalEntryId: string,
    userId: string
  ): Promise<void> => {
    const entry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.userId, userId),
        eq(journalEntries.status, "posted")
      ),
      with: {
        lines: {
          with: {
            account: true,
          },
        },
      },
    });

    if (!entry) return;

    // Create ledger transactions for each line
    for (const line of entry.lines) {
      const account = line.account;

      // Calculate running balance
      const priorTransactions = await db.query.ledgerTransactions.findMany({
        where: and(
          eq(ledgerTransactions.userId, userId),
          eq(ledgerTransactions.accountId, account.id),
          sql`${ledgerTransactions.transactionDate} <= ${entry.entryDate}`
        ),
        orderBy: [
          desc(ledgerTransactions.transactionDate),
          desc(ledgerTransactions.createdAt),
        ],
        limit: 1,
      });

      let runningBalance = new Decimal(account.openingBalance ?? "0");
      if (priorTransactions.length > 0) {
        runningBalance = new Decimal(priorTransactions[0]!.runningBalance);
      }

      // Update running balance
      if (account.normalBalance === "debit") {
        runningBalance = runningBalance
          .plus(line.debitAmount)
          .minus(line.creditAmount);
      } else {
        runningBalance = runningBalance
          .plus(line.creditAmount)
          .minus(line.debitAmount);
      }

      // Insert ledger transaction
      await db.insert(ledgerTransactions).values({
        userId,
        accountId: account.id,
        journalEntryId: entry.id,
        journalEntryLineId: line.id,
        transactionDate: entry.entryDate,
        entryNumber: entry.entryNumber,
        description: line.description || entry.description,
        reference: entry.reference,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        runningBalance: runningBalance.toFixed(2),
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
      });
    }
  },

  rebuildLedgerTransactions: async (
    userId: string,
    accountId?: string
  ): Promise<{ rebuilt: number }> => {
    // Delete existing ledger transactions
    if (accountId) {
      await db
        .delete(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.userId, userId),
            eq(ledgerTransactions.accountId, accountId)
          )
        );
    } else {
      await db
        .delete(ledgerTransactions)
        .where(eq(ledgerTransactions.userId, userId));
    }

    // Get all posted journal entries
    const entries = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.userId, userId),
        eq(journalEntries.status, "posted")
      ),
      orderBy: [asc(journalEntries.entryDate), asc(journalEntries.createdAt)],
      with: {
        lines: {
          with: {
            account: true,
          },
        },
      },
    });

    // Track running balances per account
    const accountBalancesMap = new Map<string, Decimal>();
    let rebuilt = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (accountId && line.accountId !== accountId) continue;

        const account = line.account;

        // Get or initialize running balance
        let runningBalance =
          accountBalancesMap.get(account.id) ||
          new Decimal(account.openingBalance ?? "0");

        // Update running balance
        if (account.normalBalance === "debit") {
          runningBalance = runningBalance
            .plus(line.debitAmount)
            .minus(line.creditAmount);
        } else {
          runningBalance = runningBalance
            .plus(line.creditAmount)
            .minus(line.debitAmount);
        }

        accountBalancesMap.set(account.id, runningBalance);

        // Insert ledger transaction
        await db.insert(ledgerTransactions).values({
          userId,
          accountId: account.id,
          journalEntryId: entry.id,
          journalEntryLineId: line.id,
          transactionDate: entry.entryDate,
          entryNumber: entry.entryNumber,
          description: line.description || entry.description,
          reference: entry.reference,
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          runningBalance: runningBalance.toFixed(2),
          accountCode: account.code,
          accountName: account.name,
          accountType: account.accountType,
          normalBalance: account.normalBalance,
        });

        rebuilt++;
      }
    }

    return { rebuilt };
  },

  // ============= Search =============

  searchTransactions: async (
    userId: string,
    options: {
      query?: string;
      accountType?: AccountType;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<GeneralLedgerEntry[]> => {
    const { query, accountType, startDate, endDate, limit = 50 } = options;

    const conditions = [eq(ledgerTransactions.userId, userId)];

    if (accountType) {
      conditions.push(eq(ledgerTransactions.accountType, accountType));
    }
    if (startDate) {
      conditions.push(gte(ledgerTransactions.transactionDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(ledgerTransactions.transactionDate, endDate));
    }
    if (query) {
      conditions.push(
        sql`(${ledgerTransactions.description} ILIKE ${"%" + query + "%"} OR ${ledgerTransactions.reference} ILIKE ${"%" + query + "%"} OR ${ledgerTransactions.entryNumber} ILIKE ${"%" + query + "%"})`
      );
    }

    const results = await db.query.ledgerTransactions.findMany({
      where: and(...conditions),
      orderBy: [
        desc(ledgerTransactions.transactionDate),
        desc(ledgerTransactions.createdAt),
      ],
      limit,
    });

    return results.map((t) => ({
      id: t.id,
      transactionDate: t.transactionDate,
      entryNumber: t.entryNumber,
      description: t.description,
      reference: t.reference,
      debitAmount: t.debitAmount,
      creditAmount: t.creditAmount,
      runningBalance: t.runningBalance,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
    }));
  },
};

export type LedgerRepository = typeof ledgerRepository;
