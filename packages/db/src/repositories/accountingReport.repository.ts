import { eq, and, isNull, asc } from "drizzle-orm";
import Decimal from "decimal.js";
import { db } from "../index";
import { accounts } from "../schema";
import { accountRepository, type AccountTreeNode } from "./account.repository";
import { journalEntryRepository } from "./journalEntry.repository";

// Balance tolerance for financial calculations (smallest currency unit)
const BALANCE_TOLERANCE = new Decimal("0.01");

// ============= Repository =============

export const accountingReportRepository = {
  getTrialBalance: async (userId: string, asOfDate?: string) => {
    const allAccounts = await db.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
        eq(accounts.isHeader, false)
      ),
      orderBy: [asc(accounts.code)],
    });

    const balances = [];
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const account of allAccounts) {
      const balance = await journalEntryRepository.getAccountBalance(
        account.id,
        userId,
        asOfDate
      );

      if (balance) {
        const balanceDecimal = new Decimal(balance.balance);

        // Only include accounts with non-zero balance (using tolerance)
        if (balanceDecimal.abs().greaterThan(BALANCE_TOLERANCE)) {
          let debitBalance = "0";
          let creditBalance = "0";

          if (balanceDecimal.greaterThan(0)) {
            if (account.normalBalance === "debit") {
              debitBalance = balance.balance;
              totalDebits = totalDebits.plus(balanceDecimal);
            } else {
              creditBalance = balance.balance;
              totalCredits = totalCredits.plus(balanceDecimal);
            }
          } else {
            // Negative balance - contra account
            if (account.normalBalance === "debit") {
              creditBalance = balanceDecimal.abs().toFixed(2);
              totalCredits = totalCredits.plus(balanceDecimal.abs());
            } else {
              debitBalance = balanceDecimal.abs().toFixed(2);
              totalDebits = totalDebits.plus(balanceDecimal.abs());
            }
          }

          balances.push({
            ...balance,
            debitBalance,
            creditBalance,
          });
        }
      }
    }

    return {
      accounts: balances,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: totalDebits.minus(totalCredits).abs().lessThanOrEqualTo(BALANCE_TOLERANCE),
    };
  },

  getAccountSummaryByType: async (userId: string) => {
    const accountTree = await accountRepository.getTree(userId);

    const summary = {
      assets: { total: 0, accounts: [] as AccountTreeNode[] },
      liabilities: { total: 0, accounts: [] as AccountTreeNode[] },
      equity: { total: 0, accounts: [] as AccountTreeNode[] },
      revenue: { total: 0, accounts: [] as AccountTreeNode[] },
      expenses: { total: 0, accounts: [] as AccountTreeNode[] },
    };

    const calculateTotal = (nodes: AccountTreeNode[]): number => {
      let total = 0;
      for (const node of nodes) {
        if (!node.isHeader) {
          total += parseFloat(node.balance);
        }
        if (node.children.length > 0) {
          total += calculateTotal(node.children);
        }
      }
      return total;
    };

    for (const account of accountTree) {
      const type = account.accountType as keyof typeof summary;
      if (summary[type]) {
        summary[type].accounts.push(account);
      }
    }

    // Calculate totals
    for (const type of Object.keys(summary) as (keyof typeof summary)[]) {
      summary[type].total = calculateTotal(summary[type].accounts);
    }

    return summary;
  },
};

export type AccountingReportRepository = typeof accountingReportRepository;
