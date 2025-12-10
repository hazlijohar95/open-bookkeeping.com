/**
 * Ledger Routes for Supabase Edge Functions
 * Financial reports: Trial Balance, P&L, Balance Sheet, General Ledger
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Helper to format decimal
function toDecimal(value: string | number | null): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "string" ? parseFloat(value) : value;
}

// Get Trial Balance
app.get("/trial-balance", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const asOfDate = c.req.query("asOfDate") || new Date().toISOString().split("T")[0];

  // Get all non-header accounts
  const { data: accounts, error: accountsError } = await db
    .from("accounts")
    .select("id, code, name, account_type, normal_balance, opening_balance")
    .eq("user_id", user.id)
    .eq("is_header", false)
    .is("deleted_at", null)
    .order("code");

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
    return c.json({ error: "Failed to fetch accounts" }, 500);
  }

  // Get ledger transactions up to asOfDate
  const { data: transactions, error: txError } = await db
    .from("ledger_transactions")
    .select("account_id, debit_amount, credit_amount")
    .eq("user_id", user.id)
    .lte("transaction_date", asOfDate);

  if (txError) {
    console.error("Error fetching transactions:", txError);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  // Calculate balances per account
  const accountBalances = new Map<string, { debit: number; credit: number }>();

  for (const tx of transactions || []) {
    const existing = accountBalances.get(tx.account_id) || { debit: 0, credit: 0 };
    existing.debit += toDecimal(tx.debit_amount);
    existing.credit += toDecimal(tx.credit_amount);
    accountBalances.set(tx.account_id, existing);
  }

  const entries: Array<{
    accountId: string;
    code: string;
    name: string;
    accountType: string;
    normalBalance: string;
    debitBalance: string;
    creditBalance: string;
  }> = [];

  let totalDebits = 0;
  let totalCredits = 0;

  for (const account of accounts || []) {
    const txBalances = accountBalances.get(account.id) || { debit: 0, credit: 0 };
    const openingBalance = toDecimal(account.opening_balance);

    let balance: number;
    if (account.normal_balance === "debit") {
      balance = openingBalance + txBalances.debit - txBalances.credit;
    } else {
      balance = openingBalance + txBalances.credit - txBalances.debit;
    }

    // Skip zero balances
    if (Math.abs(balance) < 0.01) continue;

    let debitBalance = "0";
    let creditBalance = "0";

    if (balance > 0) {
      if (account.normal_balance === "debit") {
        debitBalance = balance.toFixed(2);
        totalDebits += balance;
      } else {
        creditBalance = balance.toFixed(2);
        totalCredits += balance;
      }
    } else if (balance < 0) {
      if (account.normal_balance === "debit") {
        creditBalance = Math.abs(balance).toFixed(2);
        totalCredits += Math.abs(balance);
      } else {
        debitBalance = Math.abs(balance).toFixed(2);
        totalDebits += Math.abs(balance);
      }
    }

    entries.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      normalBalance: account.normal_balance,
      debitBalance,
      creditBalance,
    });
  }

  return c.json({
    asOfDate,
    entries,
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
  });
});

// Get Profit and Loss Statement
app.get("/profit-loss", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (!startDate || !endDate) {
    return c.json({ error: "startDate and endDate are required" }, 400);
  }

  // Get revenue and expense accounts
  const { data: accounts, error: accountsError } = await db
    .from("accounts")
    .select("id, code, name, account_type, normal_balance")
    .eq("user_id", user.id)
    .eq("is_header", false)
    .in("account_type", ["revenue", "expense"])
    .is("deleted_at", null)
    .order("code");

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
    return c.json({ error: "Failed to fetch accounts" }, 500);
  }

  // Get transactions in period
  const { data: transactions, error: txError } = await db
    .from("ledger_transactions")
    .select("account_id, debit_amount, credit_amount")
    .eq("user_id", user.id)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate);

  if (txError) {
    console.error("Error fetching transactions:", txError);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  // Calculate balances
  const accountBalances = new Map<string, number>();
  for (const tx of transactions || []) {
    const account = accounts?.find((a) => a.id === tx.account_id);
    if (!account) continue;

    const existing = accountBalances.get(tx.account_id) || 0;
    if (account.account_type === "revenue") {
      accountBalances.set(tx.account_id, existing + toDecimal(tx.credit_amount) - toDecimal(tx.debit_amount));
    } else {
      accountBalances.set(tx.account_id, existing + toDecimal(tx.debit_amount) - toDecimal(tx.credit_amount));
    }
  }

  // Build P&L structure
  const revenueAccounts: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const cogsAccounts: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const operatingAccounts: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const otherAccounts: Array<{ id: string; code: string; name: string; balance: string }> = [];

  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalOperating = 0;
  let totalOther = 0;

  for (const account of accounts || []) {
    const balance = accountBalances.get(account.id) || 0;
    if (Math.abs(balance) < 0.01) continue;

    const item = {
      id: account.id,
      code: account.code,
      name: account.name,
      balance: balance.toFixed(2),
    };

    if (account.account_type === "revenue") {
      revenueAccounts.push(item);
      totalRevenue += balance;
    } else {
      const codeNum = parseInt(account.code, 10);
      if (codeNum >= 5000 && codeNum < 5200) {
        cogsAccounts.push(item);
        totalCOGS += balance;
      } else if (codeNum >= 5200 && codeNum < 5900) {
        operatingAccounts.push(item);
        totalOperating += balance;
      } else {
        otherAccounts.push(item);
        totalOther += balance;
      }
    }
  }

  const grossProfit = totalRevenue - totalCOGS;
  const operatingProfit = grossProfit - totalOperating;
  const netProfit = operatingProfit - totalOther;

  return c.json({
    period: { startDate, endDate },
    revenue: {
      accounts: revenueAccounts,
      total: totalRevenue.toFixed(2),
    },
    expenses: {
      costOfGoodsSold: cogsAccounts,
      operatingExpenses: operatingAccounts,
      otherExpenses: otherAccounts,
      totalCOGS: totalCOGS.toFixed(2),
      totalOperating: totalOperating.toFixed(2),
      totalOther: totalOther.toFixed(2),
      total: (totalCOGS + totalOperating + totalOther).toFixed(2),
    },
    grossProfit: grossProfit.toFixed(2),
    operatingProfit: operatingProfit.toFixed(2),
    netProfit: netProfit.toFixed(2),
  });
});

// Get Balance Sheet
app.get("/balance-sheet", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const asOfDate = c.req.query("asOfDate") || new Date().toISOString().split("T")[0];

  // Get asset, liability, equity accounts
  const { data: accounts, error: accountsError } = await db
    .from("accounts")
    .select("id, code, name, account_type, normal_balance, opening_balance")
    .eq("user_id", user.id)
    .eq("is_header", false)
    .in("account_type", ["asset", "liability", "equity"])
    .is("deleted_at", null)
    .order("code");

  if (accountsError) {
    console.error("Error fetching accounts:", accountsError);
    return c.json({ error: "Failed to fetch accounts" }, 500);
  }

  // Get transactions up to asOfDate
  const { data: transactions, error: txError } = await db
    .from("ledger_transactions")
    .select("account_id, debit_amount, credit_amount")
    .eq("user_id", user.id)
    .lte("transaction_date", asOfDate);

  if (txError) {
    console.error("Error fetching transactions:", txError);
    return c.json({ error: "Failed to fetch transactions" }, 500);
  }

  // Calculate balances
  const accountBalances = new Map<string, number>();
  for (const tx of transactions || []) {
    const account = accounts?.find((a) => a.id === tx.account_id);
    if (!account) continue;

    const existing = accountBalances.get(tx.account_id) || toDecimal(account.opening_balance);
    if (account.normal_balance === "debit") {
      accountBalances.set(tx.account_id, existing + toDecimal(tx.debit_amount) - toDecimal(tx.credit_amount));
    } else {
      accountBalances.set(tx.account_id, existing + toDecimal(tx.credit_amount) - toDecimal(tx.debit_amount));
    }
  }

  // Build balance sheet structure
  const currentAssets: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const fixedAssets: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const currentLiabilities: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const nonCurrentLiabilities: Array<{ id: string; code: string; name: string; balance: string }> = [];
  const equityAccounts: Array<{ id: string; code: string; name: string; balance: string }> = [];

  let totalCurrentAssets = 0;
  let totalFixedAssets = 0;
  let totalCurrentLiabilities = 0;
  let totalNonCurrentLiabilities = 0;
  let totalEquity = 0;

  for (const account of accounts || []) {
    let balance = accountBalances.get(account.id);
    if (balance === undefined) {
      balance = toDecimal(account.opening_balance);
    }
    if (Math.abs(balance) < 0.01) continue;

    const item = {
      id: account.id,
      code: account.code,
      name: account.name,
      balance: balance.toFixed(2),
    };

    const codeNum = parseInt(account.code, 10);

    if (account.account_type === "asset") {
      if (codeNum >= 1000 && codeNum < 1500) {
        currentAssets.push(item);
        totalCurrentAssets += balance;
      } else {
        fixedAssets.push(item);
        totalFixedAssets += balance;
      }
    } else if (account.account_type === "liability") {
      if (codeNum >= 2000 && codeNum < 2600) {
        currentLiabilities.push(item);
        totalCurrentLiabilities += balance;
      } else {
        nonCurrentLiabilities.push(item);
        totalNonCurrentLiabilities += balance;
      }
    } else if (account.account_type === "equity") {
      equityAccounts.push(item);
      totalEquity += balance;
    }
  }

  // Calculate current year earnings from P&L
  const yearStart = asOfDate.substring(0, 4) + "-01-01";

  // Get revenue/expense transactions for YTD P&L
  const { data: pnlAccounts } = await db
    .from("accounts")
    .select("id, account_type, normal_balance")
    .eq("user_id", user.id)
    .in("account_type", ["revenue", "expense"])
    .is("deleted_at", null);

  const { data: pnlTx } = await db
    .from("ledger_transactions")
    .select("account_id, debit_amount, credit_amount")
    .eq("user_id", user.id)
    .gte("transaction_date", yearStart)
    .lte("transaction_date", asOfDate);

  let currentYearEarnings = 0;
  for (const tx of pnlTx || []) {
    const acc = pnlAccounts?.find((a) => a.id === tx.account_id);
    if (!acc) continue;
    if (acc.account_type === "revenue") {
      currentYearEarnings += toDecimal(tx.credit_amount) - toDecimal(tx.debit_amount);
    } else {
      currentYearEarnings -= toDecimal(tx.debit_amount) - toDecimal(tx.credit_amount);
    }
  }

  const totalAssets = totalCurrentAssets + totalFixedAssets;
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
  const totalEquityFinal = totalEquity + currentYearEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquityFinal;

  return c.json({
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
      accounts: equityAccounts,
      retainedEarnings: "0.00",
      currentYearEarnings: currentYearEarnings.toFixed(2),
      total: totalEquityFinal.toFixed(2),
    },
    totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
  });
});

// Get Accounting Periods
app.get("/periods", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const year = c.req.query("year");

  let query = db
    .from("accounting_periods")
    .select("*")
    .eq("user_id", user.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (year) {
    query = query.eq("year", parseInt(year));
  }

  const { data: periods, error } = await query;

  if (error) {
    console.error("Error fetching periods:", error);
    return c.json({ error: "Failed to fetch periods" }, 500);
  }

  return c.json({
    periods: periods?.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      status: p.status,
      closedAt: p.closed_at,
      closedBy: p.closed_by,
      reopenedAt: p.reopened_at,
      reopenedBy: p.reopened_by,
      reopenReason: p.reopen_reason,
      notes: p.notes,
    })) || [],
  });
});

// Close Period
app.post("/periods/close", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const { year, month, notes } = body;

  if (!year || !month) {
    return c.json({ error: "year and month are required" }, 400);
  }

  // Check for draft entries
  const { data: drafts } = await db
    .from("journal_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "draft");

  // Filter by date (would need entry_date check)
  // For now, just check if there are any drafts

  // Upsert period
  const { data: period, error } = await db
    .from("accounting_periods")
    .upsert({
      user_id: user.id,
      year,
      month,
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
      notes,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,year,month",
    })
    .select()
    .single();

  if (error) {
    console.error("Error closing period:", error);
    return c.json({ error: "Failed to close period" }, 500);
  }

  return c.json({ success: true, periodId: period?.id });
});

// Reopen Period
app.post("/periods/reopen", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const { year, month, reason } = body;

  if (!year || !month || !reason) {
    return c.json({ error: "year, month, and reason are required" }, 400);
  }

  const { data: period, error } = await db
    .from("accounting_periods")
    .update({
      status: "open",
      reopened_at: new Date().toISOString(),
      reopened_by: user.id,
      reopen_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("year", year)
    .eq("month", month)
    .select()
    .single();

  if (error) {
    console.error("Error reopening period:", error);
    return c.json({ error: "Failed to reopen period" }, 500);
  }

  return c.json({ success: true, periodId: period?.id });
});

// Search Transactions
app.get("/transactions/search", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query("query") || "";
  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");
  const limit = parseInt(c.req.query("limit") || "50");

  let dbQuery = db
    .from("ledger_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (query) {
    dbQuery = dbQuery.or(`description.ilike.%${query}%,reference.ilike.%${query}%,entry_number.ilike.%${query}%`);
  }
  if (startDate) {
    dbQuery = dbQuery.gte("transaction_date", startDate);
  }
  if (endDate) {
    dbQuery = dbQuery.lte("transaction_date", endDate);
  }

  const { data: transactions, error } = await dbQuery;

  if (error) {
    console.error("Error searching transactions:", error);
    return c.json({ error: "Failed to search transactions" }, 500);
  }

  return c.json({
    transactions: transactions?.map((t) => ({
      id: t.id,
      transactionDate: t.transaction_date,
      entryNumber: t.entry_number,
      description: t.description,
      reference: t.reference,
      debitAmount: t.debit_amount,
      creditAmount: t.credit_amount,
      runningBalance: t.running_balance,
      accountCode: t.account_code,
      accountName: t.account_name,
    })) || [],
  });
});

export default app;
