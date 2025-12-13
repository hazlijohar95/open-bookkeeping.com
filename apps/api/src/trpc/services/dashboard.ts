import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  db,
  invoices,
  invoiceFields,
  invoiceDetails,
  invoiceItems,
  invoiceClientDetails,
  quotations,
  invoiceMonthlyTotals,
  customers,
} from "@open-bookkeeping/db";
import { eq, and, gte, lte, desc, count, sql, isNull } from "drizzle-orm";
import { aggregationService } from "../../services/aggregation.service";
import {
  getCachedInvoiceStatus,
  setCachedInvoiceStatus,
  getCachedTopCustomers,
  setCachedTopCustomers,
  getCachedRecentInvoices,
  setCachedRecentInvoices,
} from "../../lib/cache";

/**
 * Get quotation statistics using database aggregation (N+1 fix)
 * Returns total count and converted count in a single query
 */
async function getQuotationStats(userId: string): Promise<{
  totalQuotations: number;
  convertedQuotations: number;
  conversionRate: number;
}> {
  // Use a single query with conditional count to get both metrics
  const result = await db
    .select({
      total: count(),
      converted: count(
        sql`CASE WHEN ${quotations.status} = 'converted' THEN 1 END`
      ),
    })
    .from(quotations)
    .where(eq(quotations.userId, userId));

  const stats = result[0] ?? { total: 0, converted: 0 };
  const totalQuotations = Number(stats.total);
  const convertedQuotations = Number(stats.converted);
  const conversionRate =
    totalQuotations > 0
      ? Math.round((convertedQuotations / totalQuotations) * 100)
      : 0;

  return { totalQuotations, convertedQuotations, conversionRate };
}

export const dashboardRouter = router({
  // Get dashboard statistics (uses fast aggregation-based approach)
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Check if aggregation data exists
    const hasAggregations = await db.query.invoiceMonthlyTotals.findFirst({
      where: eq(invoiceMonthlyTotals.userId, userId),
    });

    // If no aggregations exist, rebuild them (first-time setup)
    if (!hasAggregations) {
      await aggregationService.rebuildAllMonthlyTotals(userId);
    }

    // Run both queries in parallel for better performance
    const [stats, quotationStats] = await Promise.all([
      aggregationService.getDashboardStats(userId),
      getQuotationStats(userId), // Uses DB aggregation, not N+1
    ]);

    return {
      totalInvoices: stats.totalInvoices,
      totalRevenue: stats.totalRevenue,
      pendingAmount: stats.pendingAmount,
      overdueCount: stats.overdueCount,
      overdueAmount: 0, // Not tracked in aggregations yet
      paidThisMonth: stats.paidThisMonth,
      revenueThisMonth: stats.revenueThisMonth,
      totalQuotations: quotationStats.totalQuotations,
      convertedQuotations: quotationStats.convertedQuotations,
      conversionRate: quotationStats.conversionRate,
      currency: "MYR", // Default, could be fetched from settings
    };
  }),

  // Get fast dashboard statistics using pre-computed aggregations
  getStatsFast: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Check if aggregation data exists
    const hasAggregations = await db.query.invoiceMonthlyTotals.findFirst({
      where: eq(invoiceMonthlyTotals.userId, userId),
    });

    // If no aggregations exist, rebuild them (first-time setup)
    if (!hasAggregations) {
      await aggregationService.rebuildAllMonthlyTotals(userId);
    }

    // Run both queries in parallel for better performance
    const [stats, quotationStats] = await Promise.all([
      aggregationService.getDashboardStats(userId),
      getQuotationStats(userId), // Uses DB aggregation, not N+1
    ]);

    return {
      totalInvoices: stats.totalInvoices,
      totalRevenue: stats.totalRevenue,
      pendingAmount: stats.pendingAmount,
      overdueCount: stats.overdueCount,
      overdueAmount: 0, // Not tracked in aggregations yet
      paidThisMonth: stats.paidThisMonth,
      revenueThisMonth: stats.revenueThisMonth,
      totalQuotations: quotationStats.totalQuotations,
      convertedQuotations: quotationStats.convertedQuotations,
      conversionRate: quotationStats.conversionRate,
      currency: "MYR", // Default, could be fetched from settings
    };
  }),

  // Get fast revenue chart data from aggregations
  getRevenueChartFast: protectedProcedure
    .input(
      z.object({
        months: z.number().min(1).max(24).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      return aggregationService.getRevenueChartData(userId, input.months);
    }),

  // Trigger aggregation rebuild (for admin/maintenance)
  rebuildAggregations: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    await aggregationService.rebuildAllMonthlyTotals(userId);
    return { success: true };
  }),

  // Get revenue chart data using SQL aggregation (optimized)
  getRevenueChart: protectedProcedure
    .input(
      z.object({
        period: z.enum(["7d", "30d", "90d", "12m"]).default("30d"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const now = new Date();
      let startDate: Date;
      let groupBy: "day" | "week" | "month";

      switch (input.period) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          groupBy = "day";
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          groupBy = "day";
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          groupBy = "week";
          break;
        case "12m":
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          groupBy = "month";
          break;
      }

      // Use SQL aggregation with DATE_TRUNC - much faster than loading all invoices
      let dateExpr: ReturnType<typeof sql>;
      if (groupBy === "day") {
        dateExpr = sql`DATE(${invoices.paidAt})`;
      } else if (groupBy === "week") {
        dateExpr = sql`DATE_TRUNC('week', ${invoices.paidAt})::date`;
      } else {
        dateExpr = sql`TO_CHAR(${invoices.paidAt}, 'YYYY-MM')`;
      }

      const revenueData = await db
        .select({
          period: dateExpr.as("period"),
          revenue: sql<string>`COALESCE(SUM(${invoiceItems.quantity}::numeric * ${invoiceItems.unitPrice}), 0)`,
        })
        .from(invoices)
        .innerJoin(invoiceFields, eq(invoiceFields.invoiceId, invoices.id))
        .innerJoin(invoiceItems, eq(invoiceItems.invoiceFieldId, invoiceFields.id))
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.status, "success"),
            isNull(invoices.deletedAt),
            gte(invoices.paidAt, startDate)
          )
        )
        .groupBy(dateExpr)
        .orderBy(dateExpr);

      // Build lookup map for fast access
      const dataMap = new Map<string, number>();
      for (const row of revenueData) {
        const key = String(row.period);
        dataMap.set(key, parseFloat(row.revenue));
      }

      // Generate all periods to fill gaps
      const data: { date: string; revenue: number }[] = [];
      const current = new Date(startDate);

      while (current <= now) {
        let key: string;

        if (groupBy === "day") {
          key = current.toISOString().split("T")[0] ?? "";
          current.setDate(current.getDate() + 1);
        } else if (groupBy === "week") {
          const weekStart = new Date(current);
          weekStart.setDate(current.getDate() - current.getDay());
          key = weekStart.toISOString().split("T")[0] ?? "";
          current.setDate(current.getDate() + 7);
        } else {
          key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
          current.setMonth(current.getMonth() + 1);
        }

        if (!data.find((d) => d.date === key)) {
          data.push({
            date: key,
            revenue: dataMap.get(key) ?? 0,
          });
        }
      }

      return data;
    }),

  // Get invoice status breakdown using SQL aggregation (optimized + cached)
  getInvoiceStatusBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Check cache first
    type StatusBreakdown = { pending: number; paid: number; overdue: number; expired: number; refunded: number };
    const cached = await getCachedInvoiceStatus<StatusBreakdown>(userId);
    if (cached) return cached;

    const now = new Date();

    // Single SQL query with conditional counting - much faster than loading all invoices
    const result = await db
      .select({
        paid: count(sql`CASE WHEN ${invoices.status} = 'success' THEN 1 END`),
        expired: count(sql`CASE WHEN ${invoices.status} = 'expired' THEN 1 END`),
        refunded: count(sql`CASE WHEN ${invoices.status} = 'refunded' THEN 1 END`),
        // For pending, we need to check overdue separately via a subquery
        pendingTotal: count(sql`CASE WHEN ${invoices.status} = 'pending' THEN 1 END`),
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), isNull(invoices.deletedAt)));

    const stats = result[0] ?? { paid: 0, expired: 0, refunded: 0, pendingTotal: 0 };

    // Get overdue count with a separate efficient query (using index on dueDate)
    const overdueResult = await db
      .select({ count: count() })
      .from(invoices)
      .innerJoin(invoiceFields, eq(invoiceFields.invoiceId, invoices.id))
      .innerJoin(invoiceDetails, eq(invoiceDetails.invoiceFieldId, invoiceFields.id))
      .where(
        and(
          eq(invoices.userId, userId),
          eq(invoices.status, "pending"),
          isNull(invoices.deletedAt),
          lte(invoiceDetails.dueDate, now)
        )
      );

    const overdueCount = overdueResult[0]?.count ?? 0;
    const pendingCount = Number(stats.pendingTotal) - Number(overdueCount);

    const breakdown: StatusBreakdown = {
      pending: pendingCount,
      paid: Number(stats.paid),
      overdue: Number(overdueCount),
      expired: Number(stats.expired),
      refunded: Number(stats.refunded),
    };

    // Cache for 2 minutes
    void setCachedInvoiceStatus(userId, breakdown);

    return breakdown;
  }),

  // Get top customers by revenue using SQL aggregation (optimized + cached)
  getTopCustomers: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(20).default(5),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit || 5;

      // Check cache first
      type TopCustomer = { id: string | null; name: string; email: string | null; revenue: number; invoiceCount: number };
      const cached = await getCachedTopCustomers<TopCustomer[]>(userId, limit);
      if (cached) return cached;

      // Use SQL aggregation with GROUP BY - much faster than loading all invoices
      const result = await db
        .select({
          customerId: invoices.customerId,
          customerName: customers.name,
          customerEmail: customers.email,
          revenue: sql<string>`COALESCE(SUM(${invoiceItems.quantity}::numeric * ${invoiceItems.unitPrice}), 0)`,
          invoiceCount: count(sql`DISTINCT ${invoices.id}`),
        })
        .from(invoices)
        .innerJoin(invoiceFields, eq(invoiceFields.invoiceId, invoices.id))
        .innerJoin(invoiceItems, eq(invoiceItems.invoiceFieldId, invoiceFields.id))
        .leftJoin(customers, eq(customers.id, invoices.customerId))
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.status, "success"),
            isNull(invoices.deletedAt)
          )
        )
        .groupBy(invoices.customerId, customers.name, customers.email)
        .orderBy(desc(sql`SUM(${invoiceItems.quantity}::numeric * ${invoiceItems.unitPrice})`))
        .limit(limit);

      // For invoices without customerId, get from inline client details
      const inlineResult = await db
        .select({
          clientName: invoiceClientDetails.name,
          revenue: sql<string>`COALESCE(SUM(${invoiceItems.quantity}::numeric * ${invoiceItems.unitPrice}), 0)`,
          invoiceCount: count(sql`DISTINCT ${invoices.id}`),
        })
        .from(invoices)
        .innerJoin(invoiceFields, eq(invoiceFields.invoiceId, invoices.id))
        .innerJoin(invoiceItems, eq(invoiceItems.invoiceFieldId, invoiceFields.id))
        .innerJoin(invoiceClientDetails, eq(invoiceClientDetails.invoiceFieldId, invoiceFields.id))
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.status, "success"),
            isNull(invoices.deletedAt),
            isNull(invoices.customerId)
          )
        )
        .groupBy(invoiceClientDetails.name)
        .orderBy(desc(sql`SUM(${invoiceItems.quantity}::numeric * ${invoiceItems.unitPrice})`))
        .limit(limit);

      // Combine and sort results
      const combined: TopCustomer[] = [
        ...result.map((r) => ({
          id: r.customerId,
          name: r.customerName ?? "Unknown Customer",
          email: r.customerEmail ?? null,
          revenue: parseFloat(r.revenue),
          invoiceCount: Number(r.invoiceCount),
        })),
        ...inlineResult.map((r) => ({
          id: null,
          name: r.clientName ?? "Unknown Customer",
          email: null,
          revenue: parseFloat(r.revenue),
          invoiceCount: Number(r.invoiceCount),
        })),
      ];

      const topCustomers = combined
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

      // Cache for 2 minutes
      void setCachedTopCustomers(userId, limit, topCustomers);

      return topCustomers;
    }),

  // Get recent invoices using SQL aggregation for totals (optimized + cached)
  getRecentInvoices: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(20).default(5),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit || 5;
      const now = new Date();

      // Check cache first
      type RecentInvoice = {
        id: string;
        serialNumber: string;
        customerName: string;
        total: number;
        currency: string;
        status: string;
        date: Date;
        dueDate: Date | null;
      };
      const cached = await getCachedRecentInvoices<RecentInvoice[]>(userId, limit);
      if (cached) return cached;

      // Use SQL join with SUM aggregation - much faster than loading all items
      const recentInvoices = await db
        .select({
          id: invoices.id,
          status: invoices.status,
          createdAt: invoices.createdAt,
          serialNumber: invoiceDetails.serialNumber,
          currency: invoiceDetails.currency,
          dueDate: invoiceDetails.dueDate,
          customerName: customers.name,
          inlineCustomerName: invoiceClientDetails.name,
          total: sql<string>`COALESCE(SUM(${invoiceItems.quantity}::numeric * ${invoiceItems.unitPrice}), 0)`,
        })
        .from(invoices)
        .innerJoin(invoiceFields, eq(invoiceFields.invoiceId, invoices.id))
        .innerJoin(invoiceDetails, eq(invoiceDetails.invoiceFieldId, invoiceFields.id))
        .leftJoin(invoiceItems, eq(invoiceItems.invoiceFieldId, invoiceFields.id))
        .leftJoin(customers, eq(customers.id, invoices.customerId))
        .leftJoin(invoiceClientDetails, eq(invoiceClientDetails.invoiceFieldId, invoiceFields.id))
        .where(and(eq(invoices.userId, userId), isNull(invoices.deletedAt)))
        .groupBy(
          invoices.id,
          invoices.status,
          invoices.createdAt,
          invoiceDetails.serialNumber,
          invoiceDetails.currency,
          invoiceDetails.dueDate,
          customers.name,
          invoiceClientDetails.name
        )
        .orderBy(desc(invoices.createdAt))
        .limit(limit);

      const result: RecentInvoice[] = recentInvoices.map((invoice) => {
        const dueDate = invoice.dueDate;
        const isOverdue =
          invoice.status === "pending" &&
          dueDate &&
          new Date(dueDate) < now;

        return {
          id: invoice.id,
          serialNumber: invoice.serialNumber ?? "N/A",
          customerName: invoice.customerName || invoice.inlineCustomerName || "Unknown",
          total: parseFloat(invoice.total),
          currency: invoice.currency ?? "MYR",
          status: isOverdue ? "overdue" : invoice.status,
          date: invoice.createdAt,
          dueDate,
        };
      });

      // Cache for 2 minutes
      void setCachedRecentInvoices(userId, limit, result);

      return result;
    }),
});
