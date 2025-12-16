/**
 * Consolidated Credit Note Schema v2
 *
 * This schema consolidates the original 10 credit note tables into 3 tables:
 * 1. credit_notes_v2 - Main credit note with embedded JSONB for company/client/metadata
 * 2. credit_note_items_v2 - Line items (separate for querying and aggregation)
 * 3. credit_note_activities_v2 - Activity/audit log
 *
 * Benefits:
 * - Reduces JOINs from 9+ to 1-2
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
import {
  invoicesV2,
  type CompanyDetailsV2,
  type ClientDetailsV2,
  type BillingDetailV2,
} from "./invoicesV2";
import { creditNoteStatusEnum, noteReasonEnum } from "./enums";

// ============================================
// TYPE DEFINITIONS FOR JSONB COLUMNS
// ============================================

export interface CreditNoteTheme {
  baseColor: string;
  mode: "dark" | "light";
  template?: "default" | "cynco" | "classic";
}

export interface CreditNoteMetadataV2 {
  notes?: string;
  terms?: string;
}

// ============================================
// MAIN CREDIT NOTE TABLE
// ============================================

export const creditNotesV2 = pgTable(
  "credit_notes_v2",
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

    // Reference to original invoice
    originalInvoiceId: uuid("original_invoice_id").references(
      () => invoicesV2.id,
      { onDelete: "set null" }
    ),
    originalInvoiceNumber: varchar("original_invoice_number", { length: 100 }),

    // Type and Status
    type: varchar("type", { length: 20 }).default("server").notNull(),
    status: creditNoteStatusEnum("status").default("draft").notNull(),

    // Reason for credit note
    reason: noteReasonEnum("reason").notNull(),
    reasonDescription: text("reason_description"),

    // Credit note identification (queryable)
    prefix: varchar("prefix", { length: 20 }).default("CN-").notNull(),
    serialNumber: varchar("serial_number", { length: 50 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("MYR").notNull(),

    // Dates (queryable)
    creditNoteDate: timestamp("credit_note_date").notNull(),

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

    // Amount applied to invoices
    amountApplied: numeric("amount_applied", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    amountRemaining: numeric("amount_remaining", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),

    // Theme
    theme: jsonb("theme").$type<CreditNoteTheme>(),

    // JSONB for flexible data
    companyDetails: jsonb("company_details")
      .$type<CompanyDetailsV2>()
      .notNull(),
    clientDetails: jsonb("client_details").$type<ClientDetailsV2>().notNull(),
    billingDetails: jsonb("billing_details")
      .$type<BillingDetailV2[]>()
      .default([]),
    metadata: jsonb("metadata").$type<CreditNoteMetadataV2>().default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    issuedAt: timestamp("issued_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Primary access patterns
    index("credit_notes_v2_user_id_idx").on(table.userId),
    index("credit_notes_v2_customer_id_idx").on(table.customerId),
    index("credit_notes_v2_vendor_id_idx").on(table.vendorId),
    index("credit_notes_v2_status_idx").on(table.status),

    // Common query patterns
    index("credit_notes_v2_user_status_idx").on(table.userId, table.status),
    index("credit_notes_v2_user_created_idx").on(table.userId, table.createdAt),
    index("credit_notes_v2_user_deleted_idx").on(table.userId, table.deletedAt),
    index("credit_notes_v2_user_customer_idx").on(
      table.userId,
      table.customerId
    ),

    // Credit note lookup by number
    index("credit_notes_v2_prefix_serial_idx").on(
      table.prefix,
      table.serialNumber
    ),

    // Original invoice reference
    index("credit_notes_v2_original_invoice_idx").on(table.originalInvoiceId),

    // Reports
    index("credit_notes_v2_user_date_idx").on(
      table.userId,
      table.creditNoteDate
    ),

    // Reason filtering
    index("credit_notes_v2_user_reason_idx").on(table.userId, table.reason),
  ]
);

// ============================================
// LINE ITEMS TABLE
// ============================================

export const creditNoteItemsV2 = pgTable(
  "credit_note_items_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteId: uuid("credit_note_id")
      .references(() => creditNotesV2.id, { onDelete: "cascade" })
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
    index("credit_note_items_v2_credit_note_id_idx").on(table.creditNoteId),
  ]
);

// ============================================
// ACTIVITY LOG TABLE
// ============================================

export const creditNoteActivitiesV2 = pgTable(
  "credit_note_activities_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteId: uuid("credit_note_id")
      .references(() => creditNotesV2.id, { onDelete: "cascade" })
      .notNull(),

    action: varchar("action", { length: 50 }).notNull(), // created, updated, issued, applied, cancelled, etc.
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
    index("credit_note_activities_v2_credit_note_id_idx").on(
      table.creditNoteId
    ),
    index("credit_note_activities_v2_performed_at_idx").on(table.performedAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const creditNotesV2Relations = relations(
  creditNotesV2,
  ({ one, many }) => ({
    user: one(users, {
      fields: [creditNotesV2.userId],
      references: [users.id],
    }),
    customer: one(customers, {
      fields: [creditNotesV2.customerId],
      references: [customers.id],
    }),
    vendor: one(vendors, {
      fields: [creditNotesV2.vendorId],
      references: [vendors.id],
    }),
    originalInvoice: one(invoicesV2, {
      fields: [creditNotesV2.originalInvoiceId],
      references: [invoicesV2.id],
    }),
    items: many(creditNoteItemsV2),
    activities: many(creditNoteActivitiesV2),
  })
);

export const creditNoteItemsV2Relations = relations(
  creditNoteItemsV2,
  ({ one }) => ({
    creditNote: one(creditNotesV2, {
      fields: [creditNoteItemsV2.creditNoteId],
      references: [creditNotesV2.id],
    }),
  })
);

export const creditNoteActivitiesV2Relations = relations(
  creditNoteActivitiesV2,
  ({ one }) => ({
    creditNote: one(creditNotesV2, {
      fields: [creditNoteActivitiesV2.creditNoteId],
      references: [creditNotesV2.id],
    }),
    performer: one(users, {
      fields: [creditNoteActivitiesV2.performedBy],
      references: [users.id],
    }),
  })
);
