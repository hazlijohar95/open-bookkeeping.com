/**
 * Dashboard Repository
 * Provides efficient SQL-based aggregations for dashboard statistics
 */

import { sql } from "drizzle-orm";
import { db } from "../index";

export interface DashboardStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  revenueThisMonth: number;
  paidThisMonth: number;
  defaultCurrency: string;
}

export interface InvoiceStatusBreakdown {
  pending: number;
  paid: number;
  overdue: number;
  expired: number;
  refunded: number;
}

export interface TopCustomer {
  name: string;
  email: string | null;
  revenue: number;
  invoiceCount: number;
}

export const dashboardRepository = {
  /**
   * Get dashboard statistics using SQL aggregation
   * This is much more efficient than fetching all invoices and calculating in JS
   */
  getStats: async (userId: string): Promise<DashboardStats> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Use a single SQL query with conditional aggregation
    const result = await db.execute<{
      total_invoices: string;
      paid_invoices: string;
      pending_invoices: string;
      overdue_invoices: string;
      total_revenue: string;
      pending_amount: string;
      overdue_amount: string;
      revenue_this_month: string;
      paid_this_month: string;
      default_currency: string;
    }>(sql`
      WITH invoice_totals AS (
        SELECT
          i.id,
          i.status,
          i.paid_at,
          i.deleted_at,
          id.currency,
          id.due_date,
          COALESCE(SUM(items.quantity * items.unit_price::numeric), 0) as total
        FROM invoices i
        LEFT JOIN invoice_fields f ON f.invoice_id = i.id
        LEFT JOIN invoice_details id ON id.invoice_field_id = f.id
        LEFT JOIN invoice_items items ON items.invoice_field_id = f.id
        WHERE i.user_id = ${userId}
          AND i.deleted_at IS NULL
        GROUP BY i.id, i.status, i.paid_at, i.deleted_at, id.currency, id.due_date
      )
      SELECT
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'success') as paid_invoices,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
        COUNT(*) FILTER (WHERE status = 'pending' AND due_date < NOW()) as overdue_invoices,
        COALESCE(SUM(total) FILTER (WHERE status = 'success'), 0) as total_revenue,
        COALESCE(SUM(total) FILTER (WHERE status = 'pending'), 0) as pending_amount,
        COALESCE(SUM(total) FILTER (WHERE status = 'pending' AND due_date < NOW()), 0) as overdue_amount,
        COALESCE(SUM(total) FILTER (WHERE status = 'success' AND paid_at >= ${startOfMonth}), 0) as revenue_this_month,
        COUNT(*) FILTER (WHERE status = 'success' AND paid_at >= ${startOfMonth}) as paid_this_month,
        COALESCE(MAX(currency), 'MYR') as default_currency
      FROM invoice_totals
    `);

    const row = result[0];

    return {
      totalInvoices: Number(row?.total_invoices ?? 0),
      paidInvoices: Number(row?.paid_invoices ?? 0),
      pendingInvoices: Number(row?.pending_invoices ?? 0),
      overdueInvoices: Number(row?.overdue_invoices ?? 0),
      totalRevenue: Number(row?.total_revenue ?? 0),
      pendingAmount: Number(row?.pending_amount ?? 0),
      overdueAmount: Number(row?.overdue_amount ?? 0),
      revenueThisMonth: Number(row?.revenue_this_month ?? 0),
      paidThisMonth: Number(row?.paid_this_month ?? 0),
      defaultCurrency: String(row?.default_currency ?? "MYR"),
    };
  },

  /**
   * Get invoice status breakdown using SQL
   */
  getStatusBreakdown: async (userId: string): Promise<InvoiceStatusBreakdown> => {
    const result = await db.execute<{
      pending: string;
      paid: string;
      overdue: string;
      expired: string;
      refunded: string;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending' AND (due_date IS NULL OR due_date >= NOW())) as pending,
        COUNT(*) FILTER (WHERE status = 'success') as paid,
        COUNT(*) FILTER (WHERE status = 'pending' AND due_date < NOW()) as overdue,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'refunded') as refunded
      FROM invoices i
      LEFT JOIN invoice_fields f ON f.invoice_id = i.id
      LEFT JOIN invoice_details id ON id.invoice_field_id = f.id
      WHERE i.user_id = ${userId}
        AND i.deleted_at IS NULL
    `);

    const row = result[0];

    return {
      pending: Number(row?.pending ?? 0),
      paid: Number(row?.paid ?? 0),
      overdue: Number(row?.overdue ?? 0),
      expired: Number(row?.expired ?? 0),
      refunded: Number(row?.refunded ?? 0),
    };
  },

  /**
   * Get top customers by revenue using SQL aggregation
   */
  getTopCustomers: async (userId: string, limit: number = 5): Promise<TopCustomer[]> => {
    const result = await db.execute<{
      name: string;
      email: string | null;
      revenue: string;
      invoice_count: string;
    }>(sql`
      WITH invoice_totals AS (
        SELECT
          COALESCE(c.name, cd.name, 'Unknown Customer') as customer_name,
          c.email as customer_email,
          COALESCE(SUM(items.quantity * items.unit_price::numeric), 0) as revenue,
          COUNT(DISTINCT i.id) as invoice_count
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN invoice_fields f ON f.invoice_id = i.id
        LEFT JOIN invoice_client_details cd ON cd.invoice_field_id = f.id
        LEFT JOIN invoice_items items ON items.invoice_field_id = f.id
        WHERE i.user_id = ${userId}
          AND i.deleted_at IS NULL
          AND i.status = 'success'
        GROUP BY COALESCE(c.name, cd.name, 'Unknown Customer'), c.email
      )
      SELECT
        customer_name as name,
        customer_email as email,
        revenue,
        invoice_count
      FROM invoice_totals
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);

    return result.map((row) => ({
      name: String(row.name ?? "Unknown"),
      email: row.email ? String(row.email) : null,
      revenue: Number(row.revenue ?? 0),
      invoiceCount: Number(row.invoice_count ?? 0),
    }));
  },

  /**
   * Get revenue by period using SQL aggregation
   */
  getRevenueByPeriod: async (
    userId: string,
    startDate: Date,
    endDate: Date,
    groupBy: "day" | "week" | "month"
  ): Promise<Array<{ date: string; revenue: number }>> => {
    // Use separate queries for each groupBy to avoid SQL injection
    // DATE_TRUNC requires a literal string, not a parameterized value
    let query;

    switch (groupBy) {
      case "day":
        query = sql`
          SELECT
            TO_CHAR(DATE_TRUNC('day', i.paid_at), 'YYYY-MM-DD') as period,
            COALESCE(SUM(items.quantity * items.unit_price::numeric), 0) as revenue
          FROM invoices i
          LEFT JOIN invoice_fields f ON f.invoice_id = i.id
          LEFT JOIN invoice_items items ON items.invoice_field_id = f.id
          WHERE i.user_id = ${userId}
            AND i.deleted_at IS NULL
            AND i.status = 'success'
            AND i.paid_at >= ${startDate}
            AND i.paid_at <= ${endDate}
          GROUP BY DATE_TRUNC('day', i.paid_at)
          ORDER BY period ASC
        `;
        break;
      case "week":
        query = sql`
          SELECT
            TO_CHAR(DATE_TRUNC('week', i.paid_at), 'YYYY-MM-DD') as period,
            COALESCE(SUM(items.quantity * items.unit_price::numeric), 0) as revenue
          FROM invoices i
          LEFT JOIN invoice_fields f ON f.invoice_id = i.id
          LEFT JOIN invoice_items items ON items.invoice_field_id = f.id
          WHERE i.user_id = ${userId}
            AND i.deleted_at IS NULL
            AND i.status = 'success'
            AND i.paid_at >= ${startDate}
            AND i.paid_at <= ${endDate}
          GROUP BY DATE_TRUNC('week', i.paid_at)
          ORDER BY period ASC
        `;
        break;
      case "month":
        query = sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', i.paid_at), 'YYYY-MM') as period,
            COALESCE(SUM(items.quantity * items.unit_price::numeric), 0) as revenue
          FROM invoices i
          LEFT JOIN invoice_fields f ON f.invoice_id = i.id
          LEFT JOIN invoice_items items ON items.invoice_field_id = f.id
          WHERE i.user_id = ${userId}
            AND i.deleted_at IS NULL
            AND i.status = 'success'
            AND i.paid_at >= ${startDate}
            AND i.paid_at <= ${endDate}
          GROUP BY DATE_TRUNC('month', i.paid_at)
          ORDER BY period ASC
        `;
        break;
    }

    const result = await db.execute<{
      period: string;
      revenue: string;
    }>(query);

    return result.map((row) => ({
      date: String(row.period ?? ""),
      revenue: Number(row.revenue ?? 0),
    }));
  },

  /**
   * Get quotation stats using SQL
   */
  getQuotationStats: async (userId: string): Promise<{
    total: number;
    converted: number;
    pending: number;
    expired: number;
    conversionRate: number;
  }> => {
    const result = await db.execute<{
      total: string;
      converted: string;
      pending: string;
      expired: string;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'converted') as converted,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'expired') as expired
      FROM quotations
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
    `);

    const row = result[0];
    const total = Number(row?.total ?? 0);
    const converted = Number(row?.converted ?? 0);

    return {
      total,
      converted,
      pending: Number(row?.pending ?? 0),
      expired: Number(row?.expired ?? 0),
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    };
  },
};

export type DashboardRepository = typeof dashboardRepository;
