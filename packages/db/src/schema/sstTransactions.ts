import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { sstTaxTypeEnum } from "./enums";

// Re-export enum for convenience
export { sstTaxTypeEnum };

// SST Transactions - tracks all SST on documents for reporting
export const sstTransactions = pgTable(
  "sst_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Document reference (polymorphic - can be invoice, credit_note, debit_note)
    documentType: varchar("document_type", { length: 20 }).notNull(), // invoice, credit_note, debit_note
    documentId: uuid("document_id").notNull(),
    documentNumber: varchar("document_number", { length: 50 }), // INV-0001, CN-0001, etc.

    // SST details
    taxType: sstTaxTypeEnum("tax_type").notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull(), // e.g., 6.00, 8.00, 10.00
    taxableAmount: numeric("taxable_amount", { precision: 15, scale: 2 }).notNull(), // Amount before tax
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).notNull(), // Calculated tax

    // Period tracking for SST returns (YYYY-MM format)
    taxPeriod: varchar("tax_period", { length: 7 }).notNull(),

    // Customer/Client info for reporting
    customerName: text("customer_name"),
    customerTin: varchar("customer_tin", { length: 50 }), // Tax Identification Number

    // Document date for reporting
    documentDate: timestamp("document_date").notNull(),

    // Description/notes
    description: text("description"),

    // Audit fields
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Index for user's transactions
    index("sst_transactions_user_id_idx").on(table.userId),
    // Index for finding transactions by period (for returns)
    index("sst_transactions_user_period_idx").on(table.userId, table.taxPeriod),
    // Index for finding transactions by document
    index("sst_transactions_document_idx").on(table.documentType, table.documentId),
    // Index for tax type filtering
    index("sst_transactions_user_tax_type_idx").on(table.userId, table.taxType),
    // Index for date range queries (for reports and charts)
    index("sst_transactions_user_date_idx").on(table.userId, table.documentDate),
  ]
);

// SST Return Submissions - tracks SST-02 return submissions
export const sstReturnSubmissions = pgTable(
  "sst_return_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Period info
    taxPeriodCode: varchar("tax_period_code", { length: 7 }).notNull(), // YYYY-MM
    taxPeriodStart: timestamp("tax_period_start").notNull(),
    taxPeriodEnd: timestamp("tax_period_end").notNull(),

    // Totals (snapshot at time of generation)
    totalSalesTax: numeric("total_sales_tax", { precision: 15, scale: 2 }).notNull(),
    totalServiceTax: numeric("total_service_tax", { precision: 15, scale: 2 }).notNull(),
    totalTaxableAmount: numeric("total_taxable_amount", { precision: 15, scale: 2 }).notNull(),
    transactionCount: numeric("transaction_count").notNull(),

    // Status
    status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, submitted, amended
    submittedAt: timestamp("submitted_at"),
    referenceNumber: varchar("reference_number", { length: 50 }), // MySST reference

    // Notes
    notes: text("notes"),

    // Audit
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sst_return_submissions_user_id_idx").on(table.userId),
    index("sst_return_submissions_period_idx").on(table.userId, table.taxPeriodCode),
  ]
);

// Relations
export const sstTransactionsRelations = relations(sstTransactions, ({ one }) => ({
  user: one(users, {
    fields: [sstTransactions.userId],
    references: [users.id],
  }),
}));

export const sstReturnSubmissionsRelations = relations(sstReturnSubmissions, ({ one }) => ({
  user: one(users, {
    fields: [sstReturnSubmissions.userId],
    references: [users.id],
  }),
}));
