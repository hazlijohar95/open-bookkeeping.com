/**
 * Dashboard REST Routes
 * Provides REST API endpoints for dashboard statistics
 */

import { Hono } from "hono";
import { z } from "zod";
import { dashboardRepository, invoiceRepository } from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";
import { aggregationService } from "../services/aggregation.service";

export const dashboardRoutes = new Hono();

// GET /stats - Get dashboard statistics
dashboardRoutes.get("/stats", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    // Get stats from dashboard repository
    const stats = await dashboardRepository.getStats(user.id);
    const quotationStats = await dashboardRepository.getQuotationStats(user.id);

    return c.json({
      totalInvoices: stats.totalInvoices,
      totalRevenue: stats.totalRevenue,
      revenueThisMonth: stats.revenueThisMonth,
      pendingAmount: stats.pendingAmount,
      overdueAmount: stats.overdueAmount,
      overdueCount: stats.overdueInvoices,
      paidThisMonth: stats.paidThisMonth,
      invoicesThisMonth: stats.paidThisMonth, // Same as paidThisMonth for now
      totalQuotations: quotationStats.total,
      conversionRate: quotationStats.conversionRate,
      convertedQuotations: quotationStats.converted,
      currency: stats.defaultCurrency,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch dashboard stats");
  }
});

// GET /invoice-status - Get invoice status breakdown for pie chart
dashboardRoutes.get("/invoice-status", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const breakdown = await dashboardRepository.getStatusBreakdown(user.id);
    return c.json(breakdown);
  } catch (error) {
    console.error("Error fetching invoice status:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch invoice status");
  }
});

// GET /revenue-chart - Get revenue chart data
dashboardRoutes.get("/revenue-chart", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const period = c.req.query("period") || "30d";
    const now = new Date();
    let startDate: Date;
    let groupBy: "day" | "week" | "month";

    switch (period) {
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
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = "day";
    }

    const data = await dashboardRepository.getRevenueByPeriod(
      user.id,
      startDate,
      now,
      groupBy
    );

    return c.json(data);
  } catch (error) {
    console.error("Error fetching revenue chart:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch revenue chart");
  }
});

// GET /top-customers - Get top customers by revenue
dashboardRoutes.get("/top-customers", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const limit = Number(c.req.query("limit")) || 5;
    const customers = await dashboardRepository.getTopCustomers(user.id, limit);
    return c.json(customers);
  } catch (error) {
    console.error("Error fetching top customers:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch top customers");
  }
});

// GET /recent-invoices - Get recent invoices
dashboardRoutes.get("/recent-invoices", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const limit = Number(c.req.query("limit")) || 5;

    // Use invoice repository to get recent invoices
    const invoices = await invoiceRepository.findMany(user.id, {
      limit,
      offset: 0,
    });

    // Map to expected format
    const recentInvoices = invoices.map((inv) => {
      const invoiceDetails = inv.invoiceFields?.invoiceDetails;
      const clientDetails = inv.invoiceFields?.clientDetails;
      const items = inv.invoiceFields?.items || [];

      // Calculate total from items
      const itemsTotal = items.reduce((sum, item) => {
        return sum + (item.quantity * parseFloat(item.unitPrice || "0"));
      }, 0);

      return {
        id: inv.id,
        serialNumber: invoiceDetails?.serialNumber || "-",
        customerName: clientDetails?.name || "Unknown",
        total: itemsTotal,
        currency: invoiceDetails?.currency || "MYR",
        status: inv.status,
        date: inv.createdAt,
        dueDate: invoiceDetails?.dueDate || null,
      };
    });

    return c.json(recentInvoices);
  } catch (error) {
    console.error("Error fetching recent invoices:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch recent invoices");
  }
});

// POST /rebuild-aggregations - Rebuild aggregations (admin/maintenance)
dashboardRoutes.post("/rebuild-aggregations", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    await aggregationService.rebuildAllMonthlyTotals(user.id);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error rebuilding aggregations:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to rebuild aggregations");
  }
});
