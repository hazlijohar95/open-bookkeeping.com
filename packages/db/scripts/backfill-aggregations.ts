/**
 * Backfill Aggregations Script
 *
 * This script populates the invoice_monthly_totals and sst_monthly_totals tables
 * with pre-computed data for all existing users.
 *
 * Run with: npx tsx packages/db/scripts/backfill-aggregations.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, isNull, gte, lte, sql } from "drizzle-orm";
import * as schema from "../src/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function backfillAggregations() {
  console.log("Starting aggregation backfill...");

  // Get all unique users with invoices
  const users = await db
    .selectDistinct({ userId: schema.invoices.userId })
    .from(schema.invoices);

  console.log(`Found ${users.length} users with invoices`);

  for (const { userId } of users) {
    console.log(`\nProcessing user: ${userId}`);
    await backfillUserAggregations(userId);
  }

  console.log("\n✓ Aggregation backfill complete!");
  process.exit(0);
}

async function backfillUserAggregations(userId: string) {
  // Find date range from first to last invoice
  const firstInvoice = await db.query.invoices.findFirst({
    where: and(
      eq(schema.invoices.userId, userId),
      isNull(schema.invoices.deletedAt)
    ),
    orderBy: (invoices, { asc }) => [asc(invoices.createdAt)],
  });

  if (!firstInvoice) {
    console.log(`  No invoices found for user`);
    return;
  }

  const firstDate = new Date(firstInvoice.createdAt);
  const now = new Date();

  // Iterate through each month
  let current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  let monthCount = 0;

  while (current <= now) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;

    await updateInvoiceMonthlyTotals(userId, year, month);
    await updateSstMonthlyTotals(userId, year, month);

    monthCount++;
    current.setMonth(current.getMonth() + 1);
  }

  console.log(`  Processed ${monthCount} months`);
}

async function updateInvoiceMonthlyTotals(
  userId: string,
  year: number,
  month: number
): Promise<void> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Get all invoices for this period with their items
  const periodInvoices = await db.query.invoices.findMany({
    where: and(
      eq(schema.invoices.userId, userId),
      isNull(schema.invoices.deletedAt),
      gte(schema.invoices.createdAt, startDate),
      lte(schema.invoices.createdAt, endDate)
    ),
    with: {
      invoiceFields: {
        with: {
          invoiceDetails: true,
          items: true,
        },
      },
    },
  });

  // Calculate aggregates
  let totalRevenue = 0;
  const invoiceCount = periodInvoices.length;
  let paidCount = 0;
  let pendingAmount = 0;
  let overdueCount = 0;

  const now = new Date();

  periodInvoices.forEach((invoice) => {
    const items = invoice.invoiceFields?.items || [];
    const total = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
      0
    );

    if (invoice.status === "success") {
      paidCount++;
      totalRevenue += total;
    } else if (invoice.status === "pending") {
      pendingAmount += total;
      const dueDate = invoice.invoiceFields?.invoiceDetails?.dueDate;
      if (dueDate && new Date(dueDate) < now) {
        overdueCount++;
      }
    }
  });

  // Skip if no invoices in this period
  if (invoiceCount === 0) {
    return;
  }

  // Upsert to aggregation table
  await db
    .insert(schema.invoiceMonthlyTotals)
    .values({
      userId,
      year,
      month,
      totalRevenue: totalRevenue.toFixed(2),
      invoiceCount,
      paidCount,
      pendingAmount: pendingAmount.toFixed(2),
      overdueCount,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.invoiceMonthlyTotals.userId,
        schema.invoiceMonthlyTotals.year,
        schema.invoiceMonthlyTotals.month,
      ],
      set: {
        totalRevenue: totalRevenue.toFixed(2),
        invoiceCount,
        paidCount,
        pendingAmount: pendingAmount.toFixed(2),
        overdueCount,
        updatedAt: new Date(),
      },
    });
}

async function updateSstMonthlyTotals(
  userId: string,
  year: number,
  month: number
): Promise<void> {
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  // Get SST transactions for this period
  const transactions = await db.query.sstTransactions.findMany({
    where: and(
      eq(schema.sstTransactions.userId, userId),
      gte(schema.sstTransactions.documentDate, startDate),
      lte(schema.sstTransactions.documentDate, endDate)
    ),
  });

  // Skip if no transactions
  if (transactions.length === 0) {
    return;
  }

  // Calculate aggregates
  let salesTaxTotal = 0;
  let serviceTaxTotal = 0;
  let taxableAmount = 0;
  const transactionCount = transactions.length;

  transactions.forEach((tx) => {
    taxableAmount += Number(tx.taxableAmount || 0);
    const taxAmount = Number(tx.taxAmount || 0);

    if (tx.taxType === "sales_tax") {
      salesTaxTotal += taxAmount;
    } else if (tx.taxType === "service_tax") {
      serviceTaxTotal += taxAmount;
    }
  });

  // Upsert to aggregation table
  await db
    .insert(schema.sstMonthlyTotals)
    .values({
      userId,
      period,
      salesTaxTotal: salesTaxTotal.toFixed(2),
      serviceTaxTotal: serviceTaxTotal.toFixed(2),
      taxableAmount: taxableAmount.toFixed(2),
      transactionCount,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.sstMonthlyTotals.userId, schema.sstMonthlyTotals.period],
      set: {
        salesTaxTotal: salesTaxTotal.toFixed(2),
        serviceTaxTotal: serviceTaxTotal.toFixed(2),
        taxableAmount: taxableAmount.toFixed(2),
        transactionCount,
        updatedAt: new Date(),
      },
    });
}

// Run the script
backfillAggregations().catch((err) => {
  console.error("Error during backfill:", err);
  process.exit(1);
});
