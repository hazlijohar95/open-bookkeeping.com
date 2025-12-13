import { eq, and, asc, desc, gte, lte, isNull, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import {
  accounts,
  journalEntries,
  journalEntryLines,
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

export interface CashFlowLineItem {
  code: string;
  name: string;
  amount: string;
}

export interface CashFlowResult {
  period: { startDate: string; endDate: string };
  operatingActivities: {
    netIncome: string;
    adjustments: CashFlowLineItem[];
    changesInWorkingCapital: CashFlowLineItem[];
    netCashFromOperations: string;
  };
  investingActivities: {
    items: CashFlowLineItem[];
    netCashFromInvesting: string;
  };
  financingActivities: {
    items: CashFlowLineItem[];
    netCashFromFinancing: string;
  };
  summary: {
    netChangeInCash: string;
    beginningCash: string;
    endingCash: string;
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

    // Get all non-header accounts in a single query
    const allAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
        eq(accounts.isHeader, false)
      ),
      orderBy: [asc(accounts.code)],
    });

    // Get aggregated transaction totals per account in a SINGLE query (fixes N+1)
    const transactionTotals = await db
      .select({
        accountId: ledgerTransactions.accountId,
        totalDebits: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
      })
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.userId, userId),
          lte(ledgerTransactions.transactionDate, dateStr)
        )
      )
      .groupBy(ledgerTransactions.accountId);

    // Build a map for O(1) lookup
    const totalsMap = new Map<string, { totalDebits: string; totalCredits: string }>();
    for (const t of transactionTotals) {
      totalsMap.set(t.accountId, {
        totalDebits: t.totalDebits,
        totalCredits: t.totalCredits,
      });
    }

    const balances: TrialBalanceAccount[] = [];
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const account of allAccounts) {
      const totals = totalsMap.get(account.id);
      const transactionDebits = new Decimal(totals?.totalDebits ?? "0");
      const transactionCredits = new Decimal(totals?.totalCredits ?? "0");

      // Calculate balance respecting normal balance
      let balance = new Decimal(account.openingBalance ?? "0");
      if (account.normalBalance === "debit") {
        balance = balance.plus(transactionDebits).minus(transactionCredits);
      } else {
        balance = balance.plus(transactionCredits).minus(transactionDebits);
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

    // Get aggregated transaction totals for the period in a SINGLE query (fixes N+1)
    const transactionTotals = await db
      .select({
        accountId: ledgerTransactions.accountId,
        totalDebits: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
      })
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.userId, userId),
          gte(ledgerTransactions.transactionDate, startDate),
          lte(ledgerTransactions.transactionDate, endDate)
        )
      )
      .groupBy(ledgerTransactions.accountId);

    // Build a map for O(1) lookup
    const totalsMap = new Map<string, { totalDebits: string; totalCredits: string }>();
    for (const t of transactionTotals) {
      totalsMap.set(t.accountId, {
        totalDebits: t.totalDebits,
        totalCredits: t.totalCredits,
      });
    }

    // Calculate revenue using the map (no per-account queries)
    const revenueItems: AccountWithBalance[] = [];
    let totalRevenue = new Decimal(0);

    for (const account of revenueAccounts) {
      const totals = totalsMap.get(account.id);
      const totalDebits = new Decimal(totals?.totalDebits ?? "0");
      const totalCredits = new Decimal(totals?.totalCredits ?? "0");

      // Revenue accounts: credits increase, debits decrease
      const balance = totalCredits.minus(totalDebits);

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

    // Calculate expenses (categorized by subType or fallback to account code ranges)
    const cogsItems: AccountWithBalance[] = [];
    const operatingItems: AccountWithBalance[] = [];
    const otherItems: AccountWithBalance[] = [];
    let totalCOGS = new Decimal(0);
    let totalOperating = new Decimal(0);
    let totalOther = new Decimal(0);

    // Helper to categorize expense accounts
    const categorizeExpense = (
      account: typeof expenseAccounts[0]
    ): "cogs" | "operating" | "other" => {
      // Use subType if set (preferred)
      if (account.subType) {
        if (account.subType === "cost_of_goods_sold") return "cogs";
        if (account.subType === "operating_expense") return "operating";
        if (account.subType === "other_expense") return "other";
      }
      // Fallback to account code ranges
      const codeNum = parseInt(account.code, 10);
      if (codeNum >= 5000 && codeNum < 5200) return "cogs";
      if (codeNum >= 5200 && codeNum < 5900) return "operating";
      return "other";
    };

    for (const account of expenseAccounts) {
      const totals = totalsMap.get(account.id);
      const totalDebits = new Decimal(totals?.totalDebits ?? "0");
      const totalCredits = new Decimal(totals?.totalCredits ?? "0");

      // Expense accounts: debits increase, credits decrease
      const balance = totalDebits.minus(totalCredits);

      if (balance.abs().greaterThan(0.01)) {
        const item: AccountWithBalance = {
          id: account.id,
          code: account.code,
          name: account.name,
          balance: balance.toFixed(2),
        };

        // Categorize using subType or code fallback
        const category = categorizeExpense(account);
        if (category === "cogs") {
          cogsItems.push(item);
          totalCOGS = totalCOGS.plus(balance);
        } else if (category === "operating") {
          operatingItems.push(item);
          totalOperating = totalOperating.plus(balance);
        } else {
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
    // Get all balance sheet accounts (asset, liability, equity) in parallel
    const [assetAccounts, liabilityAccounts, equityAccounts] = await Promise.all([
      db.query.accounts.findMany({
        where: and(
          eq(accounts.userId, userId),
          eq(accounts.accountType, "asset"),
          eq(accounts.isHeader, false),
          isNull(accounts.deletedAt)
        ),
        orderBy: [asc(accounts.code)],
      }),
      db.query.accounts.findMany({
        where: and(
          eq(accounts.userId, userId),
          eq(accounts.accountType, "liability"),
          eq(accounts.isHeader, false),
          isNull(accounts.deletedAt)
        ),
        orderBy: [asc(accounts.code)],
      }),
      db.query.accounts.findMany({
        where: and(
          eq(accounts.userId, userId),
          eq(accounts.accountType, "equity"),
          eq(accounts.isHeader, false),
          isNull(accounts.deletedAt)
        ),
        orderBy: [asc(accounts.code)],
      }),
    ]);

    // Get aggregated transaction totals in a SINGLE query (fixes N+1)
    const transactionTotals = await db
      .select({
        accountId: ledgerTransactions.accountId,
        totalDebits: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
      })
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.userId, userId),
          lte(ledgerTransactions.transactionDate, asOfDate)
        )
      )
      .groupBy(ledgerTransactions.accountId);

    // Build a map for O(1) lookup
    const totalsMap = new Map<string, { totalDebits: string; totalCredits: string }>();
    for (const t of transactionTotals) {
      totalsMap.set(t.accountId, {
        totalDebits: t.totalDebits,
        totalCredits: t.totalCredits,
      });
    }

    // Helper to calculate balance using the totals map (no DB query)
    const calculateBalance = (account: typeof assetAccounts[0]): Decimal => {
      const totals = totalsMap.get(account.id);
      const totalDebits = new Decimal(totals?.totalDebits ?? "0");
      const totalCredits = new Decimal(totals?.totalCredits ?? "0");
      let balance = new Decimal(account.openingBalance ?? "0");

      if (account.normalBalance === "debit") {
        balance = balance.plus(totalDebits).minus(totalCredits);
      } else {
        balance = balance.plus(totalCredits).minus(totalDebits);
      }
      return balance;
    };

    // Helper to categorize asset accounts
    const categorizeAsset = (
      account: typeof assetAccounts[0]
    ): "current" | "fixed" => {
      // Use subType if set (preferred)
      if (account.subType === "current_asset") return "current";
      if (account.subType === "fixed_asset") return "fixed";
      // Fallback to account code ranges
      const codeNum = parseInt(account.code, 10);
      return codeNum >= 1000 && codeNum < 1500 ? "current" : "fixed";
    };

    // Process asset accounts
    const currentAssets: AccountWithBalance[] = [];
    const fixedAssets: AccountWithBalance[] = [];
    let totalCurrentAssets = new Decimal(0);
    let totalFixedAssets = new Decimal(0);

    for (const account of assetAccounts) {
      const balance = calculateBalance(account);
      if (balance.abs().lessThan(0.01)) continue;

      const item: AccountWithBalance = {
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance.toFixed(2),
      };

      if (categorizeAsset(account) === "current") {
        currentAssets.push(item);
        totalCurrentAssets = totalCurrentAssets.plus(balance);
      } else {
        fixedAssets.push(item);
        totalFixedAssets = totalFixedAssets.plus(balance);
      }
    }

    // Helper to categorize liability accounts
    const categorizeLiability = (
      account: typeof liabilityAccounts[0]
    ): "current" | "non_current" => {
      // Use subType if set (preferred)
      if (account.subType === "current_liability") return "current";
      if (account.subType === "non_current_liability") return "non_current";
      // Fallback to account code ranges
      const codeNum = parseInt(account.code, 10);
      return codeNum >= 2000 && codeNum < 2600 ? "current" : "non_current";
    };

    // Process liability accounts
    const currentLiabilities: AccountWithBalance[] = [];
    const nonCurrentLiabilities: AccountWithBalance[] = [];
    let totalCurrentLiabilities = new Decimal(0);
    let totalNonCurrentLiabilities = new Decimal(0);

    for (const account of liabilityAccounts) {
      const balance = calculateBalance(account);
      if (balance.abs().lessThan(0.01)) continue;

      const item: AccountWithBalance = {
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance.toFixed(2),
      };

      if (categorizeLiability(account) === "current") {
        currentLiabilities.push(item);
        totalCurrentLiabilities = totalCurrentLiabilities.plus(balance);
      } else {
        nonCurrentLiabilities.push(item);
        totalNonCurrentLiabilities = totalNonCurrentLiabilities.plus(balance);
      }
    }

    // Process equity accounts
    const equityItems: AccountWithBalance[] = [];
    let totalEquity = new Decimal(0);
    let retainedEarnings = new Decimal(0);

    // Retained Earnings account code (Malaysian Chart of Accounts)
    const RETAINED_EARNINGS_CODE = "3200";

    for (const account of equityAccounts) {
      const balance = calculateBalance(account);
      if (balance.abs().lessThan(0.01)) continue;

      // Separate retained earnings account from other equity accounts
      if (account.code === RETAINED_EARNINGS_CODE) {
        retainedEarnings = balance;
        continue; // Don't include in equityItems to avoid double counting
      }

      equityItems.push({
        id: account.id,
        code: account.code,
        name: account.name,
        balance: balance.toFixed(2),
      });
      totalEquity = totalEquity.plus(balance);
    }

    // Calculate current year earnings (YTD P&L)
    const yearStart = asOfDate.substring(0, 4) + "-01-01";
    const pnl = await ledgerRepository.getProfitAndLoss(
      userId,
      yearStart,
      asOfDate
    );
    const currentYearEarnings = new Decimal(pnl.netProfit);

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

  // ============= Cash Flow Statement =============

  /**
   * Generate Cash Flow Statement (Indirect Method)
   *
   * The indirect method starts with net income and adjusts for:
   * 1. Non-cash items (depreciation, amortization)
   * 2. Changes in working capital (AR, AP, inventory)
   * 3. Investing activities (fixed asset purchases/sales)
   * 4. Financing activities (loans, equity)
   */
  getCashFlowStatement: async (
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CashFlowResult> => {
    // Get P&L for net income
    const pnl = await ledgerRepository.getProfitAndLoss(userId, startDate, endDate);
    const netIncome = new Decimal(pnl.netProfit);

    // Note: Beginning balance is implicit via account opening balances

    // Get all accounts with period changes
    const allAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
        eq(accounts.isHeader, false)
      ),
    });

    // Get transaction totals for the period
    const periodTotals = await db
      .select({
        accountId: ledgerTransactions.accountId,
        totalDebits: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
      })
      .from(ledgerTransactions)
      .where(
        and(
          eq(ledgerTransactions.userId, userId),
          gte(ledgerTransactions.transactionDate, startDate),
          lte(ledgerTransactions.transactionDate, endDate)
        )
      )
      .groupBy(ledgerTransactions.accountId);

    const periodMap = new Map<string, { debits: Decimal; credits: Decimal }>();
    for (const row of periodTotals) {
      periodMap.set(row.accountId, {
        debits: new Decimal(row.totalDebits),
        credits: new Decimal(row.totalCredits),
      });
    }

    // Helper to get period change for an account
    const getPeriodChange = (account: typeof allAccounts[0]): Decimal => {
      const totals = periodMap.get(account.id);
      if (!totals) return new Decimal(0);
      if (account.normalBalance === "debit") {
        return totals.debits.minus(totals.credits);
      }
      return totals.credits.minus(totals.debits);
    };

    // ============= Operating Activities =============
    const adjustments: CashFlowLineItem[] = [];
    let totalAdjustments = new Decimal(0);

    // Find depreciation/amortization accounts (expense accounts that are non-cash)
    // Typically codes 5800-5899 or accounts with "depreciation" or "amortization" in name
    for (const account of allAccounts) {
      if (account.accountType !== "expense") continue;

      const isDepreciation =
        account.name.toLowerCase().includes("depreciation") ||
        account.name.toLowerCase().includes("amortization") ||
        (parseInt(account.code) >= 5800 && parseInt(account.code) < 5900);

      if (isDepreciation) {
        const change = getPeriodChange(account);
        if (change.abs().greaterThan(0.01)) {
          adjustments.push({
            code: account.code,
            name: `Add: ${account.name}`,
            amount: change.toFixed(2),
          });
          totalAdjustments = totalAdjustments.plus(change);
        }
      }
    }

    // Working capital changes (current assets and liabilities)
    const workingCapitalChanges: CashFlowLineItem[] = [];
    let totalWorkingCapitalChange = new Decimal(0);

    // Accounts Receivable (increase = cash outflow)
    const arAccounts = allAccounts.filter(
      (a) => a.accountType === "asset" && a.code.startsWith("11")
    );
    let arChange = new Decimal(0);
    for (const account of arAccounts) {
      arChange = arChange.plus(getPeriodChange(account));
    }
    if (arChange.abs().greaterThan(0.01)) {
      workingCapitalChanges.push({
        code: "1100",
        name: arChange.greaterThan(0) ? "Decrease: Accounts Receivable" : "Increase: Accounts Receivable",
        amount: arChange.negated().toFixed(2), // Increase in AR = cash outflow (negative)
      });
      totalWorkingCapitalChange = totalWorkingCapitalChange.minus(arChange);
    }

    // Inventory (increase = cash outflow)
    const inventoryAccounts = allAccounts.filter(
      (a) => a.accountType === "asset" && a.code.startsWith("12")
    );
    let inventoryChange = new Decimal(0);
    for (const account of inventoryAccounts) {
      inventoryChange = inventoryChange.plus(getPeriodChange(account));
    }
    if (inventoryChange.abs().greaterThan(0.01)) {
      workingCapitalChanges.push({
        code: "1200",
        name: inventoryChange.greaterThan(0) ? "Decrease: Inventory" : "Increase: Inventory",
        amount: inventoryChange.negated().toFixed(2),
      });
      totalWorkingCapitalChange = totalWorkingCapitalChange.minus(inventoryChange);
    }

    // Accounts Payable (increase = cash inflow)
    const apAccounts = allAccounts.filter(
      (a) => a.accountType === "liability" && a.code.startsWith("21")
    );
    let apChange = new Decimal(0);
    for (const account of apAccounts) {
      apChange = apChange.plus(getPeriodChange(account));
    }
    if (apChange.abs().greaterThan(0.01)) {
      workingCapitalChanges.push({
        code: "2100",
        name: apChange.greaterThan(0) ? "Increase: Accounts Payable" : "Decrease: Accounts Payable",
        amount: apChange.toFixed(2), // Increase in AP = cash inflow (positive)
      });
      totalWorkingCapitalChange = totalWorkingCapitalChange.plus(apChange);
    }

    // Other current liabilities (accruals, taxes payable)
    const otherCLAccounts = allAccounts.filter(
      (a) =>
        a.accountType === "liability" &&
        a.code.startsWith("2") &&
        !a.code.startsWith("21") &&
        parseInt(a.code) < 2600
    );
    let otherCLChange = new Decimal(0);
    for (const account of otherCLAccounts) {
      otherCLChange = otherCLChange.plus(getPeriodChange(account));
    }
    if (otherCLChange.abs().greaterThan(0.01)) {
      workingCapitalChanges.push({
        code: "2200",
        name: otherCLChange.greaterThan(0) ? "Increase: Other Current Liabilities" : "Decrease: Other Current Liabilities",
        amount: otherCLChange.toFixed(2),
      });
      totalWorkingCapitalChange = totalWorkingCapitalChange.plus(otherCLChange);
    }

    const netCashFromOperations = netIncome
      .plus(totalAdjustments)
      .plus(totalWorkingCapitalChange);

    // ============= Investing Activities =============
    const investingItems: CashFlowLineItem[] = [];
    let totalInvesting = new Decimal(0);

    // Fixed assets (increase = cash outflow for purchases)
    const fixedAssetAccounts = allAccounts.filter(
      (a) => a.accountType === "asset" && parseInt(a.code) >= 1500
    );
    for (const account of fixedAssetAccounts) {
      const change = getPeriodChange(account);
      if (change.abs().greaterThan(0.01)) {
        investingItems.push({
          code: account.code,
          name: change.greaterThan(0) ? `Purchase: ${account.name}` : `Sale: ${account.name}`,
          amount: change.negated().toFixed(2), // Purchase = outflow (negative)
        });
        totalInvesting = totalInvesting.minus(change);
      }
    }

    // ============= Financing Activities =============
    const financingItems: CashFlowLineItem[] = [];
    let totalFinancing = new Decimal(0);

    // Long-term liabilities (loans)
    const longTermLiabilities = allAccounts.filter(
      (a) => a.accountType === "liability" && parseInt(a.code) >= 2600
    );
    for (const account of longTermLiabilities) {
      const change = getPeriodChange(account);
      if (change.abs().greaterThan(0.01)) {
        financingItems.push({
          code: account.code,
          name: change.greaterThan(0) ? `Borrowings: ${account.name}` : `Repayments: ${account.name}`,
          amount: change.toFixed(2), // Borrowing = inflow, Repayment = outflow
        });
        totalFinancing = totalFinancing.plus(change);
      }
    }

    // Equity changes (excluding retained earnings which comes from net income)
    const equityAccounts = allAccounts.filter(
      (a) => a.accountType === "equity" && a.code !== "3200" // Exclude retained earnings
    );
    for (const account of equityAccounts) {
      const change = getPeriodChange(account);
      if (change.abs().greaterThan(0.01)) {
        financingItems.push({
          code: account.code,
          name: change.greaterThan(0) ? `Capital Contribution: ${account.name}` : `Capital Withdrawal: ${account.name}`,
          amount: change.toFixed(2),
        });
        totalFinancing = totalFinancing.plus(change);
      }
    }

    // ============= Summary =============
    const netChangeInCash = netCashFromOperations
      .plus(totalInvesting)
      .plus(totalFinancing);

    // Get beginning and ending cash balances
    // Cash accounts are typically 1000-1099
    const cashAccounts = allAccounts.filter(
      (a) => a.accountType === "asset" && parseInt(a.code) >= 1000 && parseInt(a.code) < 1100
    );

    // Beginning cash = opening balance + transactions before period
    let beginningCash = new Decimal(0);
    let endingCash = new Decimal(0);

    for (const account of cashAccounts) {
      const openingBalance = new Decimal(account.openingBalance ?? "0");

      // Get transactions before period
      const priorTotals = await db
        .select({
          totalDebits: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0)`,
          totalCredits: sql<string>`COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
        })
        .from(ledgerTransactions)
        .where(
          and(
            eq(ledgerTransactions.userId, userId),
            eq(ledgerTransactions.accountId, account.id),
            sql`${ledgerTransactions.transactionDate} < ${startDate}`
          )
        );

      const priorDebits = new Decimal(priorTotals[0]?.totalDebits ?? "0");
      const priorCredits = new Decimal(priorTotals[0]?.totalCredits ?? "0");
      const periodChange = getPeriodChange(account);

      beginningCash = beginningCash.plus(openingBalance).plus(priorDebits).minus(priorCredits);
      endingCash = beginningCash.plus(periodChange);
    }

    return {
      period: { startDate, endDate },
      operatingActivities: {
        netIncome: netIncome.toFixed(2),
        adjustments,
        changesInWorkingCapital: workingCapitalChanges,
        netCashFromOperations: netCashFromOperations.toFixed(2),
      },
      investingActivities: {
        items: investingItems,
        netCashFromInvesting: totalInvesting.toFixed(2),
      },
      financingActivities: {
        items: financingItems,
        netCashFromFinancing: totalFinancing.toFixed(2),
      },
      summary: {
        netChangeInCash: netChangeInCash.toFixed(2),
        beginningCash: beginningCash.toFixed(2),
        endingCash: endingCash.toFixed(2),
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

  // ============= Account Balance Reconciliation =============

  /**
   * Reconcile account balances by comparing:
   * 1. Expected balance from journal entries
   * 2. Current balance in ledger transactions
   * 3. Account opening balance + transactions
   *
   * Returns discrepancies that need attention
   */
  reconcileAccountBalances: async (
    userId: string,
    accountId?: string
  ): Promise<{
    reconciled: number;
    discrepancies: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      expectedBalance: string;
      actualBalance: string;
      difference: string;
      openingBalance: string;
      totalDebits: string;
      totalCredits: string;
    }>;
    summary: {
      totalAccounts: number;
      accountsWithDiscrepancies: number;
      totalDifference: string;
    };
  }> => {
    // Get accounts to reconcile
    const accountConditions = [
      eq(accounts.userId, userId),
      isNull(accounts.deletedAt),
      eq(accounts.isHeader, false),
    ];

    if (accountId) {
      accountConditions.push(eq(accounts.id, accountId));
    }

    const allAccounts = await db.query.accounts.findMany({
      where: and(...accountConditions),
      orderBy: [asc(accounts.code)],
    });

    // Get aggregated transaction totals from ledger_transactions
    const ledgerTotals = await db
      .select({
        accountId: ledgerTransactions.accountId,
        totalDebits: sql<string>`COALESCE(SUM(${ledgerTransactions.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${ledgerTransactions.creditAmount}), 0)`,
        lastBalance: sql<string>`(
          SELECT ${ledgerTransactions.runningBalance}
          FROM ${ledgerTransactions} lt2
          WHERE lt2.account_id = ${ledgerTransactions.accountId}
          AND lt2.user_id = ${userId}
          ORDER BY lt2.transaction_date DESC, lt2.created_at DESC
          LIMIT 1
        )`,
      })
      .from(ledgerTransactions)
      .where(eq(ledgerTransactions.userId, userId))
      .groupBy(ledgerTransactions.accountId);

    const ledgerMap = new Map<
      string,
      { totalDebits: string; totalCredits: string; lastBalance: string | null }
    >();
    for (const row of ledgerTotals) {
      ledgerMap.set(row.accountId, {
        totalDebits: row.totalDebits,
        totalCredits: row.totalCredits,
        lastBalance: row.lastBalance,
      });
    }

    // Get aggregated transaction totals from journal_entry_lines (source of truth)
    const journalTotals = await db
      .select({
        accountId: journalEntryLines.accountId,
        totalDebits: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(
        journalEntries,
        and(
          eq(journalEntryLines.journalEntryId, journalEntries.id),
          eq(journalEntries.status, "posted")
        )
      )
      .where(eq(journalEntries.userId, userId))
      .groupBy(journalEntryLines.accountId);

    const journalMap = new Map<
      string,
      { totalDebits: string; totalCredits: string }
    >();
    for (const row of journalTotals) {
      journalMap.set(row.accountId, {
        totalDebits: row.totalDebits,
        totalCredits: row.totalCredits,
      });
    }

    // Compare and find discrepancies
    const discrepancies: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      expectedBalance: string;
      actualBalance: string;
      difference: string;
      openingBalance: string;
      totalDebits: string;
      totalCredits: string;
    }> = [];

    let reconciled = 0;
    let totalDifference = new Decimal(0);

    for (const account of allAccounts) {
      const ledgerData = ledgerMap.get(account.id);
      const journalData = journalMap.get(account.id);

      const openingBalance = new Decimal(account.openingBalance ?? "0");
      const journalDebits = new Decimal(journalData?.totalDebits ?? "0");
      const journalCredits = new Decimal(journalData?.totalCredits ?? "0");
      const ledgerDebits = new Decimal(ledgerData?.totalDebits ?? "0");
      const ledgerCredits = new Decimal(ledgerData?.totalCredits ?? "0");

      // Calculate expected balance from journal entries
      let expectedBalance: Decimal;
      if (account.normalBalance === "debit") {
        expectedBalance = openingBalance.plus(journalDebits).minus(journalCredits);
      } else {
        expectedBalance = openingBalance.plus(journalCredits).minus(journalDebits);
      }

      // Get actual balance from ledger (last running balance, or recalculate)
      let actualBalance: Decimal;
      if (ledgerData?.lastBalance) {
        actualBalance = new Decimal(ledgerData.lastBalance);
      } else {
        // No ledger transactions, balance should be opening balance
        actualBalance = openingBalance;
      }

      // Check for discrepancy
      const difference = expectedBalance.minus(actualBalance);

      if (difference.abs().greaterThan(0.01)) {
        discrepancies.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          expectedBalance: expectedBalance.toFixed(2),
          actualBalance: actualBalance.toFixed(2),
          difference: difference.toFixed(2),
          openingBalance: openingBalance.toFixed(2),
          totalDebits: journalDebits.toFixed(2),
          totalCredits: journalCredits.toFixed(2),
        });
        totalDifference = totalDifference.plus(difference.abs());
      } else {
        reconciled++;
      }

      // Also check if ledger totals match journal totals
      if (
        !ledgerDebits.equals(journalDebits) ||
        !ledgerCredits.equals(journalCredits)
      ) {
        // Transaction totals mismatch - ledger needs rebuild
        if (!discrepancies.find((d) => d.accountId === account.id)) {
          discrepancies.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            expectedBalance: expectedBalance.toFixed(2),
            actualBalance: actualBalance.toFixed(2),
            difference: "N/A (totals mismatch)",
            openingBalance: openingBalance.toFixed(2),
            totalDebits: `Journal: ${journalDebits.toFixed(2)} vs Ledger: ${ledgerDebits.toFixed(2)}`,
            totalCredits: `Journal: ${journalCredits.toFixed(2)} vs Ledger: ${ledgerCredits.toFixed(2)}`,
          });
        }
      }
    }

    return {
      reconciled,
      discrepancies,
      summary: {
        totalAccounts: allAccounts.length,
        accountsWithDiscrepancies: discrepancies.length,
        totalDifference: totalDifference.toFixed(2),
      },
    };
  },

  /**
   * Auto-fix account balance discrepancies by rebuilding ledger transactions
   */
  autoFixDiscrepancies: async (
    userId: string,
    accountIds?: string[]
  ): Promise<{
    fixed: number;
    errors: Array<{ accountId: string; error: string }>;
  }> => {
    const errors: Array<{ accountId: string; error: string }> = [];
    let fixed = 0;

    if (accountIds && accountIds.length > 0) {
      // Fix specific accounts
      for (const accountId of accountIds) {
        try {
          await ledgerRepository.rebuildLedgerTransactions(userId, accountId);
          fixed++;
        } catch (error) {
          errors.push({
            accountId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    } else {
      // Full rebuild
      try {
        const result = await ledgerRepository.rebuildLedgerTransactions(userId);
        fixed = result.rebuilt;
      } catch (error) {
        errors.push({
          accountId: "all",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { fixed, errors };
  },
};

export type LedgerRepository = typeof ledgerRepository;
