/**
 * Aggregation Service
 * Handles pre-computed aggregations for fast dashboard and report queries
 * Includes Redis caching for high-traffic endpoints
 */

import {
  db,
  invoices,
  invoiceMonthlyTotals,
  sstMonthlyTotals,
  sstTransactions,
} from "@open-bookkeeping/db";
import { eq, and, isNull, gte, lte } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  getCachedDashboardStats,
  setCachedDashboardStats,
  getCachedRevenueChart,
  setCachedRevenueChart,
  invalidateDashboardStats,
  invalidateRevenueChart,
} from "../lib/cache";

export class AggregationService {
  /**
   * Update monthly invoice totals for a specific user and period
   */
  async updateInvoiceMonthlyTotals(
    userId: string,
    year: number,
    month: number
  ): Promise<void> {
    // Calculate period boundaries
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all invoices for this period with their items
    const periodInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.userId, userId),
        isNull(invoices.deletedAt),
        gte(invoices.createdAt, startDate),
        lte(invoices.createdAt, endDate)
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

    // Calculate aggregates using Decimal.js for precision
    let totalRevenue = new Decimal(0);
    let invoiceCount = periodInvoices.length;
    let paidCount = 0;
    let pendingAmount = new Decimal(0);
    let overdueCount = 0;

    const now = new Date();

    periodInvoices.forEach((invoice) => {
      const items = invoice.invoiceFields?.items || [];
      const total = items.reduce(
        (sum, item) => sum.plus(new Decimal(item.unitPrice).times(item.quantity)),
        new Decimal(0)
      );

      if (invoice.status === "success") {
        paidCount++;
        totalRevenue = totalRevenue.plus(total);
      } else if (invoice.status === "pending") {
        pendingAmount = pendingAmount.plus(total);
        const dueDate = invoice.invoiceFields?.invoiceDetails?.dueDate;
        if (dueDate && new Date(dueDate) < now) {
          overdueCount++;
        }
      }
    });

    // Upsert to aggregation table
    await db
      .insert(invoiceMonthlyTotals)
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
          invoiceMonthlyTotals.userId,
          invoiceMonthlyTotals.year,
          invoiceMonthlyTotals.month,
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

    // Invalidate caches after update
    await this.invalidateCaches(userId);
  }

  /**
   * Update SST monthly totals for a specific user and period
   */
  async updateSstMonthlyTotals(userId: string, period: string): Promise<void> {
    // Period is in YYYY-MM format
    const [yearStr, monthStr] = period.split("-");
    const year = parseInt(yearStr!, 10);
    const month = parseInt(monthStr!, 10);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get SST transactions for this period
    const transactions = await db.query.sstTransactions.findMany({
      where: and(
        eq(sstTransactions.userId, userId),
        gte(sstTransactions.documentDate, startDate),
        lte(sstTransactions.documentDate, endDate)
      ),
    });

    // Calculate aggregates using Decimal.js for precision
    let salesTaxTotal = new Decimal(0);
    let serviceTaxTotal = new Decimal(0);
    let taxableAmount = new Decimal(0);
    const transactionCount = transactions.length;

    transactions.forEach((tx) => {
      taxableAmount = taxableAmount.plus(new Decimal(tx.taxableAmount || 0));
      const taxAmount = new Decimal(tx.taxAmount || 0);

      if (tx.taxType === "sales_tax") {
        salesTaxTotal = salesTaxTotal.plus(taxAmount);
      } else if (tx.taxType === "service_tax") {
        serviceTaxTotal = serviceTaxTotal.plus(taxAmount);
      }
    });

    // Upsert to aggregation table
    await db
      .insert(sstMonthlyTotals)
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
        target: [sstMonthlyTotals.userId, sstMonthlyTotals.period],
        set: {
          salesTaxTotal: salesTaxTotal.toFixed(2),
          serviceTaxTotal: serviceTaxTotal.toFixed(2),
          taxableAmount: taxableAmount.toFixed(2),
          transactionCount,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Rebuild all monthly totals for a user (used for initial migration)
   */
  async rebuildAllMonthlyTotals(userId: string): Promise<void> {
    // Find the date range from first to last invoice
    const firstInvoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.userId, userId), isNull(invoices.deletedAt)),
      orderBy: (invoices, { asc }) => [asc(invoices.createdAt)],
    });

    if (!firstInvoice) {
      return; // No invoices to aggregate
    }

    const firstDate = new Date(firstInvoice.createdAt);
    const now = new Date();

    // Iterate through each month from first invoice to now
    let current = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);

    while (current <= now) {
      await this.updateInvoiceMonthlyTotals(
        userId,
        current.getFullYear(),
        current.getMonth() + 1
      );

      // Also update SST totals
      const period = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      await this.updateSstMonthlyTotals(userId, period);

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }
  }

  /**
   * Get aggregated dashboard stats from pre-computed tables
   * Uses Redis caching for performance
   */
  async getDashboardStats(userId: string): Promise<{
    totalRevenue: number;
    totalInvoices: number;
    paidCount: number;
    pendingAmount: number;
    overdueCount: number;
    revenueThisMonth: number;
    paidThisMonth: number;
  }> {
    // Check cache first
    type DashboardStats = {
      totalRevenue: number;
      totalInvoices: number;
      paidCount: number;
      pendingAmount: number;
      overdueCount: number;
      revenueThisMonth: number;
      paidThisMonth: number;
    };

    const cached = await getCachedDashboardStats<DashboardStats>(userId);
    if (cached) {
      return cached;
    }

    const monthlyTotals = await db.query.invoiceMonthlyTotals.findMany({
      where: eq(invoiceMonthlyTotals.userId, userId),
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const currentMonthData = monthlyTotals.find(
      (m) => m.year === currentYear && m.month === currentMonth
    );

    // Sum all monthly totals
    const totalRevenue = monthlyTotals.reduce(
      (sum, m) => sum + Number(m.totalRevenue),
      0
    );
    const totalInvoices = monthlyTotals.reduce(
      (sum, m) => sum + (m.invoiceCount || 0),
      0
    );
    const paidCount = monthlyTotals.reduce(
      (sum, m) => sum + (m.paidCount || 0),
      0
    );

    const result = {
      totalRevenue,
      totalInvoices,
      paidCount,
      pendingAmount: Number(currentMonthData?.pendingAmount || 0),
      overdueCount: currentMonthData?.overdueCount || 0,
      revenueThisMonth: Number(currentMonthData?.totalRevenue || 0),
      paidThisMonth: currentMonthData?.paidCount || 0,
    };

    // Cache the result
    await setCachedDashboardStats(userId, result);

    return result;
  }

  /**
   * Get revenue chart data from pre-computed monthly totals
   * Uses Redis caching for performance
   */
  async getRevenueChartData(
    userId: string,
    months: number = 12
  ): Promise<{ date: string; revenue: number }[]> {
    // Check cache first
    type ChartData = { date: string; revenue: number }[];
    const cached = await getCachedRevenueChart<ChartData>(userId, months);
    if (cached) {
      return cached;
    }

    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth() + 1;

    const monthlyTotals = await db.query.invoiceMonthlyTotals.findMany({
      where: eq(invoiceMonthlyTotals.userId, userId),
      orderBy: (table, { desc }) => [desc(table.year), desc(table.month)],
    });

    // Create a map for quick lookup
    const totalsMap = new Map<string, number>();
    monthlyTotals.forEach((m) => {
      const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
      totalsMap.set(key, Number(m.totalRevenue));
    });

    // Generate data for the last N months
    const data: ChartData = [];
    const current = new Date(startYear, startMonth - months, 1);

    while (current <= now) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      data.push({
        date: key,
        revenue: totalsMap.get(key) || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }

    // Cache the result
    await setCachedRevenueChart(userId, months, data);

    return data;
  }

  /**
   * Invalidate dashboard caches for a user
   * Call this after invoice mutations
   */
  async invalidateCaches(userId: string): Promise<void> {
    await Promise.all([
      invalidateDashboardStats(userId),
      invalidateRevenueChart(userId),
    ]);
  }
}

// Export singleton instance
export const aggregationService = new AggregationService();
