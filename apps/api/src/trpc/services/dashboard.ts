import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db, invoices, quotations, invoiceMonthlyTotals } from "@open-bookkeeping/db";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";
import { aggregationService } from "../../services/aggregation.service";

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

  // Get revenue chart data
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

      const paidInvoices = await db.query.invoices.findMany({
        where: and(
          eq(invoices.userId, userId),
          eq(invoices.status, "success"),
          gte(invoices.paidAt, startDate)
        ),
        with: {
          invoiceFields: {
            with: {
              invoiceDetails: true,
              items: true,
            },
          },
        },
        orderBy: [invoices.paidAt],
      });

      // Group data by period
      const dataMap = new Map<string, number>();

      paidInvoices.forEach((invoice) => {
        if (!invoice.paidAt || !invoice.invoiceFields?.items) return;

        const date = new Date(invoice.paidAt);
        let key: string;

        if (groupBy === "day") {
          key = date.toISOString().split("T")[0] ?? "";
        } else if (groupBy === "week") {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0] ?? "";
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }

        const total = invoice.invoiceFields.items.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
          0
        );

        dataMap.set(key, (dataMap.get(key) ?? 0) + total);
      });

      // Generate all periods
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

  // Get invoice status breakdown
  getInvoiceStatusBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const allInvoices = await db.query.invoices.findMany({
      where: eq(invoices.userId, userId),
      with: {
        invoiceFields: {
          with: {
            invoiceDetails: true,
          },
        },
      },
    });

    const breakdown = {
      pending: 0,
      paid: 0,
      overdue: 0,
      expired: 0,
      refunded: 0,
    };

    allInvoices.forEach((invoice) => {
      if (invoice.status === "success") {
        breakdown.paid++;
      } else if (invoice.status === "pending") {
        const dueDate = invoice.invoiceFields?.invoiceDetails?.dueDate;
        if (dueDate && new Date(dueDate) < new Date()) {
          breakdown.overdue++;
        } else {
          breakdown.pending++;
        }
      } else if (invoice.status === "expired") {
        breakdown.expired++;
      } else if (invoice.status === "refunded") {
        breakdown.refunded++;
      }
    });

    return breakdown;
  }),

  // Get top customers by revenue
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

      // Get all paid invoices with customer data
      const paidInvoices = await db.query.invoices.findMany({
        where: and(eq(invoices.userId, userId), eq(invoices.status, "success")),
        with: {
          customer: true,
          invoiceFields: {
            with: {
              clientDetails: true,
              items: true,
            },
          },
        },
      });

      // Group by customer ID (not name) to prevent collision
      const customerRevenue = new Map<
        string,
        { id: string | null; name: string; email: string | null; revenue: number; invoiceCount: number }
      >();

      paidInvoices.forEach((invoice) => {
        if (!invoice.invoiceFields?.items) return;

        // Use customer ID as grouping key, falling back to name for inline customers
        const customerId = invoice.customerId || invoice.customer?.id;
        const customerName =
          invoice.customer?.name ||
          invoice.invoiceFields?.clientDetails?.name ||
          "Unknown Customer";
        const customerEmail = invoice.customer?.email ?? null;

        // Use ID if available, otherwise use prefixed name for inline customers
        const key = customerId || `inline:${customerName}`;

        const total = invoice.invoiceFields.items.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
          0
        );

        const existing = customerRevenue.get(key);
        if (existing) {
          existing.revenue += total;
          existing.invoiceCount++;
        } else {
          customerRevenue.set(key, {
            id: customerId ?? null,
            name: customerName,
            email: customerEmail,
            revenue: total,
            invoiceCount: 1,
          });
        }
      });

      // Sort by revenue and return top N
      return Array.from(customerRevenue.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    }),

  // Get recent invoices
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

      const recentInvoices = await db.query.invoices.findMany({
        where: eq(invoices.userId, userId),
        with: {
          customer: true,
          invoiceFields: {
            with: {
              clientDetails: true,
              invoiceDetails: true,
              items: true,
            },
          },
        },
        orderBy: [desc(invoices.createdAt)],
        limit,
      });

      return recentInvoices.map((invoice) => {
        const total = invoice.invoiceFields?.items?.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
          0
        ) ?? 0;

        const dueDate = invoice.invoiceFields?.invoiceDetails?.dueDate;
        const isOverdue =
          invoice.status === "pending" &&
          dueDate &&
          new Date(dueDate) < new Date();

        return {
          id: invoice.id,
          serialNumber:
            invoice.invoiceFields?.invoiceDetails?.serialNumber ?? "N/A",
          customerName:
            invoice.customer?.name ||
            invoice.invoiceFields?.clientDetails?.name ||
            "Unknown",
          total,
          currency:
            invoice.invoiceFields?.invoiceDetails?.currency ?? "MYR",
          status: isOverdue ? "overdue" : invoice.status,
          date: invoice.createdAt,
          dueDate,
        };
      });
    }),
});
