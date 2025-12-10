/**
 * Consolidated Invoice Schema v2
 *
 * This schema consolidates the original 11 invoice tables into 4 tables:
 * 1. invoices_v2 - Main invoice with embedded JSONB for company/client/metadata
 * 2. invoice_items_v2 - Line items (separate for querying and aggregation)
 * 3. invoice_payments_v2 - Payment records for partial payments
 * 4. invoice_activities_v2 - Activity/audit log
 *
 * Benefits:
 * - Reduces JOINs from 10+ to 1-2
 * - Simplifies queries and repository code
 * - JSONB allows flexible metadata without schema changes
 * - Maintains queryable fields for filtering/sorting
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  varchar,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { customers } from "./customers";
import { vendors } from "./vendors";
import { invoiceStatusEnum } from "./enums";

// ============================================
// TYPE DEFINITIONS FOR JSONB COLUMNS
// ============================================

export interface InvoiceTheme {
  baseColor: string;
  mode: "dark" | "light";
  template?: "default" | "cynco" | "classic" | "zen" | "executive";
}

export interface MetadataField {
  label: string;
  value: string;
}

export interface CompanyDetailsV2 {
  name: string;
  address: string;
  logo?: string | null;
  signature?: string | null;
  metadata?: MetadataField[];
}

export interface ClientDetailsV2 {
  name: string;
  address: string;
  metadata?: MetadataField[];
}

export interface BillingDetailV2 {
  label: string;
  type: "fixed" | "percentage";
  value: string; // Stored as string for decimal precision
  isSstTax?: boolean;
  sstTaxType?: "sales_tax" | "service_tax";
  sstRateCode?: string;
}

export interface InvoiceMetadataV2 {
  notes?: string;
  terms?: string;
  paymentInformation?: MetadataField[];
}

// ============================================
// MAIN INVOICE TABLE
// ============================================

export const invoicesV2 = pgTable(
  "invoices_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),

    // Type and Status
    type: varchar("type", { length: 20 }).default("server").notNull(),
    status: invoiceStatusEnum("status").default("pending").notNull(),
    einvoiceStatus: varchar("einvoice_status", { length: 20 }),

    // Invoice identification (queryable)
    prefix: varchar("prefix", { length: 20 }).notNull(),
    serialNumber: varchar("serial_number", { length: 50 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("MYR").notNull(),

    // Dates (queryable)
    invoiceDate: timestamp("invoice_date").notNull(),
    dueDate: timestamp("due_date"),
    paymentTerms: text("payment_terms"),

    // Calculated totals for efficient queries (denormalized)
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }).default("0").notNull(),
    taxTotal: numeric("tax_total", { precision: 15, scale: 2 }).default("0").notNull(),
    discountTotal: numeric("discount_total", { precision: 15, scale: 2 }).default("0").notNull(),
    total: numeric("total", { precision: 15, scale: 2 }).default("0").notNull(),
    amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default("0").notNull(),
    amountDue: numeric("amount_due", { precision: 15, scale: 2 }).default("0").notNull(),

    // Theme
    theme: jsonb("theme").$type<InvoiceTheme>(),

    // JSONB for flexible data (reduces tables from 11 to 1)
    companyDetails: jsonb("company_details").$type<CompanyDetailsV2>().notNull(),
    clientDetails: jsonb("client_details").$type<ClientDetailsV2>().notNull(),
    billingDetails: jsonb("billing_details").$type<BillingDetailV2[]>().default([]),
    metadata: jsonb("metadata").$type<InvoiceMetadataV2>().default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Primary access patterns
    index("invoices_v2_user_id_idx").on(table.userId),
    index("invoices_v2_customer_id_idx").on(table.customerId),
    index("invoices_v2_vendor_id_idx").on(table.vendorId),
    index("invoices_v2_status_idx").on(table.status),

    // Common query patterns
    index("invoices_v2_user_status_idx").on(table.userId, table.status),
    index("invoices_v2_user_created_idx").on(table.userId, table.createdAt),
    index("invoices_v2_user_deleted_idx").on(table.userId, table.deletedAt),
    index("invoices_v2_user_customer_idx").on(table.userId, table.customerId),

    // Invoice lookup by number
    index("invoices_v2_prefix_serial_idx").on(table.prefix, table.serialNumber),

    // Financial reports
    index("invoices_v2_user_invoice_date_idx").on(table.userId, table.invoiceDate),
    index("invoices_v2_user_due_date_idx").on(table.userId, table.dueDate),

    // Dashboard queries
    index("invoices_v2_user_status_total_idx").on(table.userId, table.status, table.total),
  ]
);

// ============================================
// LINE ITEMS TABLE
// ============================================

export const invoiceItemsV2 = pgTable(
  "invoice_items_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .references(() => invoicesV2.id, { onDelete: "cascade" })
      .notNull(),

    // Item details
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

    // Optional fields for advanced line items
    unit: varchar("unit", { length: 20 }),
    sku: varchar("sku", { length: 100 }),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    discount: numeric("discount", { precision: 15, scale: 2 }),

    // Ordering
    sortOrder: numeric("sort_order").default("0"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invoice_items_v2_invoice_id_idx").on(table.invoiceId),
  ]
);

// ============================================
// PAYMENTS TABLE
// ============================================

export const invoicePaymentsV2 = pgTable(
  "invoice_payments_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .references(() => invoicesV2.id, { onDelete: "cascade" })
      .notNull(),

    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull(),
    method: varchar("method", { length: 50 }), // cash, bank_transfer, card, etc.
    reference: varchar("reference", { length: 255 }), // payment reference/transaction ID

    paidAt: timestamp("paid_at").notNull(),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => [
    index("invoice_payments_v2_invoice_id_idx").on(table.invoiceId),
    index("invoice_payments_v2_paid_at_idx").on(table.paidAt),
  ]
);

// ============================================
// ACTIVITY LOG TABLE
// ============================================

export const invoiceActivitiesV2 = pgTable(
  "invoice_activities_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .references(() => invoicesV2.id, { onDelete: "cascade" })
      .notNull(),

    action: varchar("action", { length: 50 }).notNull(), // created, updated, sent, viewed, paid, etc.
    description: text("description"),
    changes: jsonb("changes").$type<Record<string, { old: unknown; new: unknown }>>(),

    performedBy: uuid("performed_by").references(() => users.id),
    performedAt: timestamp("performed_at").defaultNow().notNull(),

    // Additional context
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("invoice_activities_v2_invoice_id_idx").on(table.invoiceId),
    index("invoice_activities_v2_performed_at_idx").on(table.performedAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const invoicesV2Relations = relations(invoicesV2, ({ one, many }) => ({
  user: one(users, {
    fields: [invoicesV2.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [invoicesV2.customerId],
    references: [customers.id],
  }),
  vendor: one(vendors, {
    fields: [invoicesV2.vendorId],
    references: [vendors.id],
  }),
  items: many(invoiceItemsV2),
  payments: many(invoicePaymentsV2),
  activities: many(invoiceActivitiesV2),
}));

export const invoiceItemsV2Relations = relations(invoiceItemsV2, ({ one }) => ({
  invoice: one(invoicesV2, {
    fields: [invoiceItemsV2.invoiceId],
    references: [invoicesV2.id],
  }),
}));

export const invoicePaymentsV2Relations = relations(invoicePaymentsV2, ({ one }) => ({
  invoice: one(invoicesV2, {
    fields: [invoicePaymentsV2.invoiceId],
    references: [invoicesV2.id],
  }),
  createdByUser: one(users, {
    fields: [invoicePaymentsV2.createdBy],
    references: [users.id],
  }),
}));

export const invoiceActivitiesV2Relations = relations(invoiceActivitiesV2, ({ one }) => ({
  invoice: one(invoicesV2, {
    fields: [invoiceActivitiesV2.invoiceId],
    references: [invoicesV2.id],
  }),
  performer: one(users, {
    fields: [invoiceActivitiesV2.performedBy],
    references: [users.id],
  }),
}));
