import {
  pgTable,
  uuid,
  timestamp,
  numeric,
  index,
  integer,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Monthly invoice totals for fast dashboard queries
export const invoiceMonthlyTotals = pgTable(
  "invoice_monthly_totals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12

    // Revenue metrics
    totalRevenue: numeric("total_revenue", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    invoiceCount: integer("invoice_count").default(0).notNull(),
    paidCount: integer("paid_count").default(0).notNull(),
    pendingAmount: numeric("pending_amount", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    overdueCount: integer("overdue_count").default(0).notNull(),

    // Timestamps
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoice_monthly_totals_user_idx").on(table.userId),
    index("invoice_monthly_totals_period_idx").on(table.year, table.month),
    // Unique constraint for upsert operations
    unique("invoice_monthly_totals_user_period_unique").on(
      table.userId,
      table.year,
      table.month
    ),
  ]
);

// SST monthly totals for compliance reports
export const sstMonthlyTotals = pgTable(
  "sst_monthly_totals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    period: varchar("period", { length: 7 }).notNull(), // YYYY-MM format

    // Tax totals
    salesTaxTotal: numeric("sales_tax_total", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    serviceTaxTotal: numeric("service_tax_total", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    transactionCount: integer("transaction_count").default(0).notNull(),

    // Timestamps
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sst_monthly_totals_user_idx").on(table.userId),
    // Unique constraint for upsert operations
    unique("sst_monthly_totals_user_period_unique").on(table.userId, table.period),
  ]
);

// Relations
export const invoiceMonthlyTotalsRelations = relations(
  invoiceMonthlyTotals,
  ({ one }) => ({
    user: one(users, {
      fields: [invoiceMonthlyTotals.userId],
      references: [users.id],
    }),
  })
);

export const sstMonthlyTotalsRelations = relations(
  sstMonthlyTotals,
  ({ one }) => ({
    user: one(users, {
      fields: [sstMonthlyTotals.userId],
      references: [users.id],
    }),
  })
);

// TypeScript types
export type InvoiceMonthlyTotal = typeof invoiceMonthlyTotals.$inferSelect;
export type NewInvoiceMonthlyTotal = typeof invoiceMonthlyTotals.$inferInsert;
export type SstMonthlyTotal = typeof sstMonthlyTotals.$inferSelect;
export type NewSstMonthlyTotal = typeof sstMonthlyTotals.$inferInsert;
