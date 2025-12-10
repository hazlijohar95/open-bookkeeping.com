/**
 * Dashboard Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/dashboard.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Helper function to calculate invoice total
function calculateInvoiceTotal(items: Array<{ quantity: number; unit_price: string }> | null): number {
  if (!items) return 0;
  return items.reduce((sum, item) => {
    return sum + Number(item.quantity) * Number(item.unit_price);
  }, 0);
}

// Get dashboard statistics (FAST - uses pre-aggregated data)
app.get("/stats", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Run all queries in parallel for maximum speed
  const [monthlyTotalsResult, overdueResult, quotationsResult, settingsResult] = await Promise.all([
    // Get aggregated monthly totals (fast - pre-computed)
    db
      .from("invoice_monthly_totals")
      .select("year, month, total_count, total_amount, paid_count, paid_total, pending_count, pending_total")
      .eq("user_id", user.id),

    // Get overdue count separately (needs due_date check)
    db
      .from("invoices")
      .select(`
        id,
        invoice_fields(
          invoice_details(due_date),
          items:invoice_items(quantity, unit_price)
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .is("deleted_at", null),

    // Get quotation stats (lightweight)
    db
      .from("quotations")
      .select("id, status")
      .eq("user_id", user.id)
      .is("deleted_at", null),

    // Get user's default currency from settings
    db
      .from("user_settings")
      .select("default_currency")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (monthlyTotalsResult.error) {
    console.error("Error fetching monthly totals:", monthlyTotalsResult.error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }

  // Calculate totals from aggregated data
  const monthlyTotals = monthlyTotalsResult.data || [];
  let totalInvoices = 0;
  let totalRevenue = 0;
  let pendingAmount = 0;
  let paidThisMonth = 0;
  let revenueThisMonth = 0;

  for (const month of monthlyTotals) {
    totalInvoices += month.total_count || 0;
    totalRevenue += Number(month.paid_total) || 0;
    pendingAmount += Number(month.pending_total) || 0;

    // Check if this is current month
    if (month.year === currentYear && month.month === currentMonth) {
      paidThisMonth = month.paid_count || 0;
      revenueThisMonth = Number(month.paid_total) || 0;
    }
  }

  // Calculate overdue from pending invoices
  let overdueCount = 0;
  let overdueAmount = 0;
  const pendingInvoices = overdueResult.data || [];

  for (const invoice of pendingInvoices) {
    const dueDate = invoice.invoice_fields?.[0]?.invoice_details?.[0]?.due_date;
    if (dueDate && new Date(dueDate) < now) {
      overdueCount++;
      overdueAmount += calculateInvoiceTotal(invoice.invoice_fields?.[0]?.items || null);
    }
  }

  // Quotation stats
  const allQuotations = quotationsResult.data || [];
  const totalQuotations = allQuotations.length;
  const convertedQuotations = allQuotations.filter((q) => q.status === "converted").length;
  const conversionRate = totalQuotations > 0
    ? Math.round((convertedQuotations / totalQuotations) * 100)
    : 0;

  return c.json({
    totalInvoices,
    totalRevenue,
    pendingAmount,
    overdueCount,
    overdueAmount,
    paidThisMonth,
    revenueThisMonth,
    totalQuotations,
    convertedQuotations,
    conversionRate,
    currency: settingsResult.data?.default_currency || "MYR",
  });
});

// Get invoice status breakdown
app.get("/invoice-status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: allInvoices, error } = await db
    .from("invoices")
    .select(`
      id,
      status,
      invoice_fields(
        invoice_details(due_date)
      )
    `)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching invoices:", error);
    return c.json({ error: "Failed to fetch invoice status" }, 500);
  }

  const now = new Date();
  const breakdown = {
    pending: 0,
    paid: 0,
    overdue: 0,
    expired: 0,
    refunded: 0,
  };

  allInvoices?.forEach((invoice) => {
    if (invoice.status === "success") {
      breakdown.paid++;
    } else if (invoice.status === "pending") {
      const dueDate = invoice.invoice_fields?.[0]?.invoice_details?.[0]?.due_date;
      if (dueDate && new Date(dueDate) < now) {
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

  return c.json(breakdown);
});

// Get revenue chart data
app.get("/revenue-chart", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

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

  const { data: paidInvoices, error } = await db
    .from("invoices")
    .select(`
      id,
      paid_at,
      invoice_fields(
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "success")
    .gte("paid_at", startDate.toISOString())
    .is("deleted_at", null)
    .order("paid_at", { ascending: true });

  if (error) {
    console.error("Error fetching revenue chart data:", error);
    return c.json({ error: "Failed to fetch revenue chart data" }, 500);
  }

  // Group data by period
  const dataMap = new Map<string, number>();

  paidInvoices?.forEach((invoice) => {
    if (!invoice.paid_at || !invoice.invoice_fields?.[0]?.items) return;

    const date = new Date(invoice.paid_at);
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

    const total = calculateInvoiceTotal(invoice.invoice_fields[0].items);
    dataMap.set(key, (dataMap.get(key) || 0) + total);
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
        revenue: dataMap.get(key) || 0,
      });
    }
  }

  return c.json(data);
});

// Get top customers by revenue
app.get("/top-customers", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const limit = parseInt(c.req.query("limit") || "5");

  const { data: paidInvoices, error } = await db
    .from("invoices")
    .select(`
      id,
      customer_id,
      customer:customers(id, name, email),
      invoice_fields(
        client_details:invoice_client_details(name),
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "success")
    .is("deleted_at", null);

  if (error) {
    console.error("Error fetching top customers:", error);
    return c.json({ error: "Failed to fetch top customers" }, 500);
  }

  // Group by customer ID (not name) to prevent collision
  const customerRevenue = new Map<
    string,
    { id: string | null; name: string; email: string | null; revenue: number; invoiceCount: number }
  >();

  paidInvoices?.forEach((invoice) => {
    if (!invoice.invoice_fields?.[0]?.items) return;

    // Use customer ID as the grouping key, falling back to name for ungrouped invoices
    const customerId = invoice.customer_id || invoice.customer?.id;
    const customerName =
      invoice.customer?.name ||
      invoice.invoice_fields?.[0]?.client_details?.[0]?.name ||
      "Unknown Customer";
    const customerEmail = invoice.customer?.email || null;

    // Use ID if available, otherwise use a prefixed name to distinguish inline customers
    const key = customerId || `inline:${customerName}`;

    const total = calculateInvoiceTotal(invoice.invoice_fields[0].items);

    const existing = customerRevenue.get(key);
    if (existing) {
      existing.revenue += total;
      existing.invoiceCount++;
    } else {
      customerRevenue.set(key, {
        id: customerId || null,
        name: customerName,
        email: customerEmail,
        revenue: total,
        invoiceCount: 1,
      });
    }
  });

  // Sort by revenue and return top N
  const topCustomers = Array.from(customerRevenue.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return c.json(topCustomers);
});

// Get recent invoices
app.get("/recent-invoices", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const limit = parseInt(c.req.query("limit") || "5");

  const { data: recentInvoices, error } = await db
    .from("invoices")
    .select(`
      id,
      status,
      created_at,
      customer:customers(name),
      invoice_fields(
        client_details:invoice_client_details(name),
        invoice_details(serial_number, currency, due_date),
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent invoices:", error);
    return c.json({ error: "Failed to fetch recent invoices" }, 500);
  }

  const now = new Date();

  const formatted = recentInvoices?.map((invoice) => {
    const total = calculateInvoiceTotal(invoice.invoice_fields?.[0]?.items || null);
    const dueDate = invoice.invoice_fields?.[0]?.invoice_details?.[0]?.due_date;
    const isOverdue =
      invoice.status === "pending" &&
      dueDate &&
      new Date(dueDate) < now;

    return {
      id: invoice.id,
      serialNumber:
        invoice.invoice_fields?.[0]?.invoice_details?.[0]?.serial_number || "N/A",
      customerName:
        invoice.customer?.name ||
        invoice.invoice_fields?.[0]?.client_details?.[0]?.name ||
        "Unknown",
      total,
      currency:
        invoice.invoice_fields?.[0]?.invoice_details?.[0]?.currency || "MYR",
      status: isOverdue ? "overdue" : invoice.status,
      date: invoice.created_at,
      dueDate,
    };
  });

  return c.json(formatted);
});

// Get monthly revenue chart (from aggregations)
app.get("/revenue-chart-fast", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const months = parseInt(c.req.query("months") || "12");

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const { data: monthlyTotals, error } = await db
    .from("invoice_monthly_totals")
    .select("year, month, paid_count, paid_total")
    .eq("user_id", user.id)
    .gte("year", startDate.getFullYear())
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) {
    console.error("Error fetching monthly totals:", error);
    return c.json({ error: "Failed to fetch revenue chart data" }, 500);
  }

  // Build chart data
  const data: { date: string; revenue: number; count: number }[] = [];
  const current = new Date(startDate);

  while (current <= now) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    const found = monthlyTotals?.find((t) => t.year === year && t.month === month);

    data.push({
      date: key,
      revenue: found ? Number(found.paid_total) : 0,
      count: found ? found.paid_count : 0,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return c.json(data);
});

// Rebuild aggregations (admin/maintenance)
app.post("/rebuild-aggregations", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  // Get all invoices for user
  const { data: allInvoices, error: fetchError } = await db
    .from("invoices")
    .select(`
      id,
      status,
      paid_at,
      created_at,
      invoice_fields(
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (fetchError) {
    console.error("Error fetching invoices for aggregation:", fetchError);
    return c.json({ error: "Failed to rebuild aggregations" }, 500);
  }

  // Group by year-month
  const monthlyData = new Map<
    string,
    {
      year: number;
      month: number;
      totalCount: number;
      totalAmount: number;
      paidCount: number;
      paidTotal: number;
      pendingCount: number;
      pendingTotal: number;
    }
  >();

  allInvoices?.forEach((invoice) => {
    const date = new Date(invoice.created_at);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${month}`;

    const total = calculateInvoiceTotal(invoice.invoice_fields?.[0]?.items || null);

    const existing = monthlyData.get(key) || {
      year,
      month,
      totalCount: 0,
      totalAmount: 0,
      paidCount: 0,
      paidTotal: 0,
      pendingCount: 0,
      pendingTotal: 0,
    };

    existing.totalCount++;
    existing.totalAmount += total;

    if (invoice.status === "success") {
      existing.paidCount++;
      existing.paidTotal += total;
    } else if (invoice.status === "pending") {
      existing.pendingCount++;
      existing.pendingTotal += total;
    }

    monthlyData.set(key, existing);
  });

  // Upsert monthly totals
  for (const data of monthlyData.values()) {
    const { error: upsertError } = await db
      .from("invoice_monthly_totals")
      .upsert({
        user_id: user.id,
        year: data.year,
        month: data.month,
        total_count: data.totalCount,
        total_amount: String(data.totalAmount),
        paid_count: data.paidCount,
        paid_total: String(data.paidTotal),
        pending_count: data.pendingCount,
        pending_total: String(data.pendingTotal),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,year,month",
      });

    if (upsertError) {
      console.error("Error upserting monthly totals:", upsertError);
    }
  }

  return c.json({ success: true, monthsProcessed: monthlyData.size });
});

export default app;
