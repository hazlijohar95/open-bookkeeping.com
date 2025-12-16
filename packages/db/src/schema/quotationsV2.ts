/**
 * Consolidated Quotation Schema v2
 *
 * This schema consolidates the original 11 quotation tables into 3 tables:
 * 1. quotations_v2 - Main quotation with embedded JSONB for company/client/metadata
 * 2. quotation_items_v2 - Line items (separate for querying and aggregation)
 * 3. quotation_activities_v2 - Activity/audit log
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
import {
  invoicesV2,
  type CompanyDetailsV2,
  type ClientDetailsV2,
  type BillingDetailV2,
  type MetadataField,
} from "./invoicesV2";
import { quotationStatusEnum } from "./enums";

// ============================================
// TYPE DEFINITIONS FOR JSONB COLUMNS
// ============================================

export interface QuotationTheme {
  baseColor: string;
  mode: "dark" | "light";
  template?: "default" | "cynco" | "classic"; // Quotations have fewer templates
}

export interface QuotationMetadataV2 {
  notes?: string;
  terms?: string;
  paymentInformation?: MetadataField[];
}

// ============================================
// MAIN QUOTATION TABLE
// ============================================

export const quotationsV2 = pgTable(
  "quotations_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),

    // Type and Status
    type: varchar("type", { length: 20 }).default("server").notNull(),
    status: quotationStatusEnum("status").default("draft").notNull(),

    // Quotation identification (queryable)
    prefix: varchar("prefix", { length: 20 }).notNull(),
    serialNumber: varchar("serial_number", { length: 50 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("MYR").notNull(),

    // Dates (queryable)
    quotationDate: timestamp("quotation_date").notNull(),
    validUntil: timestamp("valid_until"),
    paymentTerms: text("payment_terms"),

    // Conversion tracking
    convertedToInvoiceId: uuid("converted_to_invoice_id").references(
      () => invoicesV2.id,
      { onDelete: "set null" }
    ),
    convertedAt: timestamp("converted_at"),

    // Calculated totals for efficient queries (denormalized)
    subtotal: numeric("subtotal", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    taxTotal: numeric("tax_total", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    discountTotal: numeric("discount_total", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    total: numeric("total", { precision: 15, scale: 2 }).default("0").notNull(),

    // Theme
    theme: jsonb("theme").$type<QuotationTheme>(),

    // JSONB for flexible data
    companyDetails: jsonb("company_details")
      .$type<CompanyDetailsV2>()
      .notNull(),
    clientDetails: jsonb("client_details").$type<ClientDetailsV2>().notNull(),
    billingDetails: jsonb("billing_details")
      .$type<BillingDetailV2[]>()
      .default([]),
    metadata: jsonb("metadata").$type<QuotationMetadataV2>().default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Primary access patterns
    index("quotations_v2_user_id_idx").on(table.userId),
    index("quotations_v2_customer_id_idx").on(table.customerId),
    index("quotations_v2_status_idx").on(table.status),

    // Common query patterns
    index("quotations_v2_user_status_idx").on(table.userId, table.status),
    index("quotations_v2_user_created_idx").on(table.userId, table.createdAt),
    index("quotations_v2_user_deleted_idx").on(table.userId, table.deletedAt),
    index("quotations_v2_user_customer_idx").on(table.userId, table.customerId),

    // Quotation lookup by number
    index("quotations_v2_prefix_serial_idx").on(
      table.prefix,
      table.serialNumber
    ),

    // Reports
    index("quotations_v2_user_quotation_date_idx").on(
      table.userId,
      table.quotationDate
    ),
    index("quotations_v2_user_valid_until_idx").on(
      table.userId,
      table.validUntil
    ),

    // Conversion tracking
    index("quotations_v2_converted_invoice_idx").on(table.convertedToInvoiceId),
  ]
);

// ============================================
// LINE ITEMS TABLE
// ============================================

export const quotationItemsV2 = pgTable(
  "quotation_items_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .references(() => quotationsV2.id, { onDelete: "cascade" })
      .notNull(),

    // Item details
    name: text("name").notNull(),
    description: text("description"),
    quantity: numeric("quantity", { precision: 15, scale: 4 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),

    // Optional fields
    unit: varchar("unit", { length: 20 }),
    sku: varchar("sku", { length: 100 }),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    discount: numeric("discount", { precision: 15, scale: 2 }),

    // Ordering
    sortOrder: numeric("sort_order").default("0"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("quotation_items_v2_quotation_id_idx").on(table.quotationId),
  ]
);

// ============================================
// ACTIVITY LOG TABLE
// ============================================

export const quotationActivitiesV2 = pgTable(
  "quotation_activities_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationId: uuid("quotation_id")
      .references(() => quotationsV2.id, { onDelete: "cascade" })
      .notNull(),

    action: varchar("action", { length: 50 }).notNull(), // created, updated, sent, viewed, accepted, rejected, converted, etc.
    description: text("description"),
    changes:
      jsonb("changes").$type<Record<string, { old: unknown; new: unknown }>>(),

    performedBy: uuid("performed_by").references(() => users.id),
    performedAt: timestamp("performed_at").defaultNow().notNull(),

    // Additional context
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("quotation_activities_v2_quotation_id_idx").on(table.quotationId),
    index("quotation_activities_v2_performed_at_idx").on(table.performedAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const quotationsV2Relations = relations(
  quotationsV2,
  ({ one, many }) => ({
    user: one(users, {
      fields: [quotationsV2.userId],
      references: [users.id],
    }),
    customer: one(customers, {
      fields: [quotationsV2.customerId],
      references: [customers.id],
    }),
    convertedInvoice: one(invoicesV2, {
      fields: [quotationsV2.convertedToInvoiceId],
      references: [invoicesV2.id],
    }),
    items: many(quotationItemsV2),
    activities: many(quotationActivitiesV2),
  })
);

export const quotationItemsV2Relations = relations(
  quotationItemsV2,
  ({ one }) => ({
    quotation: one(quotationsV2, {
      fields: [quotationItemsV2.quotationId],
      references: [quotationsV2.id],
    }),
  })
);

export const quotationActivitiesV2Relations = relations(
  quotationActivitiesV2,
  ({ one }) => ({
    quotation: one(quotationsV2, {
      fields: [quotationActivitiesV2.quotationId],
      references: [quotationsV2.id],
    }),
    performer: one(users, {
      fields: [quotationActivitiesV2.performedBy],
      references: [users.id],
    }),
  })
);
