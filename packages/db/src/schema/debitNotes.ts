import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { customers } from "./customers";
import { vendors } from "./vendors";
import { invoices } from "./invoices";
import {
  debitNoteTypeEnum,
  debitNoteStatusEnum,
  noteReasonEnum,
  billingDetailTypeEnum,
} from "./enums";

// Re-export enums for backward compatibility
export { debitNoteTypeEnum, debitNoteStatusEnum };

// Main debit note table
export const debitNotes = pgTable(
  "debit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Optional reference to original invoice
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    // Link to customer/vendor for statement of accounts
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),
    type: debitNoteTypeEnum("type").default("server").notNull(),
    status: debitNoteStatusEnum("status").default("draft").notNull(),
    reason: noteReasonEnum("reason").notNull(),
    reasonDescription: text("reason_description"), // For "other" reason
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    issuedAt: timestamp("issued_at"), // Set when status = "issued"
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("debit_notes_user_id_idx").on(table.userId),
    index("debit_notes_invoice_id_idx").on(table.invoiceId),
    index("debit_notes_customer_id_idx").on(table.customerId),
    index("debit_notes_vendor_id_idx").on(table.vendorId),
    index("debit_notes_status_idx").on(table.status),
    // Composite indexes for common query patterns
    index("debit_notes_user_status_idx").on(table.userId, table.status),
    index("debit_notes_user_created_idx").on(table.userId, table.createdAt),
    index("debit_notes_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
);

// Debit note fields - one-to-one with debit_notes (hub)
export const debitNoteFields = pgTable("debit_note_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  debitNoteId: uuid("debit_note_id")
    .references(() => debitNotes.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
});

// Company details
export const debitNoteCompanyDetails = pgTable("debit_note_company_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  debitNoteFieldId: uuid("debit_note_field_id")
    .references(() => debitNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  logo: text("logo"),
  signature: text("signature"),
});

export const debitNoteCompanyDetailsMetadata = pgTable(
  "debit_note_company_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debitNoteCompanyDetailsId: uuid("debit_note_company_details_id")
      .references(() => debitNoteCompanyDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Client details
export const debitNoteClientDetails = pgTable("debit_note_client_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  debitNoteFieldId: uuid("debit_note_field_id")
    .references(() => debitNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
});

export const debitNoteClientDetailsMetadata = pgTable(
  "debit_note_client_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debitNoteClientDetailsId: uuid("debit_note_client_details_id")
      .references(() => debitNoteClientDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Debit note details (dates, currency, etc.)
export const debitNoteDetails = pgTable("debit_note_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  debitNoteFieldId: uuid("debit_note_field_id")
    .references(() => debitNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  theme: jsonb("theme").$type<{
    baseColor: string;
    mode: "dark" | "light";
    template?: "default" | "cynco" | "classic" | "zen" | "executive";
  }>(),
  currency: text("currency").notNull(),
  prefix: text("prefix").notNull().default("DN-"),
  serialNumber: text("serial_number").notNull(),
  date: timestamp("date").notNull(),
  // Reference to original invoice number (for display purposes)
  originalInvoiceNumber: text("original_invoice_number"),
});

export const debitNoteDetailsBillingDetails = pgTable(
  "debit_note_details_billing_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debitNoteDetailsId: uuid("debit_note_details_id")
      .references(() => debitNoteDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    type: billingDetailTypeEnum("type").notNull(),
    value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  }
);

// Debit note items (line items)
export const debitNoteItems = pgTable("debit_note_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  debitNoteFieldId: uuid("debit_note_field_id")
    .references(() => debitNoteFields.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
});

// Debit note metadata (notes, terms)
export const debitNoteMetadata = pgTable("debit_note_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  debitNoteFieldId: uuid("debit_note_field_id")
    .references(() => debitNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  notes: text("notes"),
  terms: text("terms"),
});

// Relations
export const debitNotesRelations = relations(debitNotes, ({ one }) => ({
  user: one(users, {
    fields: [debitNotes.userId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [debitNotes.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [debitNotes.customerId],
    references: [customers.id],
  }),
  vendor: one(vendors, {
    fields: [debitNotes.vendorId],
    references: [vendors.id],
  }),
  debitNoteFields: one(debitNoteFields),
}));

export const debitNoteFieldsRelations = relations(
  debitNoteFields,
  ({ one, many }) => ({
    debitNote: one(debitNotes, {
      fields: [debitNoteFields.debitNoteId],
      references: [debitNotes.id],
    }),
    companyDetails: one(debitNoteCompanyDetails),
    clientDetails: one(debitNoteClientDetails),
    debitNoteDetails: one(debitNoteDetails),
    items: many(debitNoteItems),
    metadata: one(debitNoteMetadata),
  })
);

export const debitNoteCompanyDetailsRelations = relations(
  debitNoteCompanyDetails,
  ({ one, many }) => ({
    debitNoteField: one(debitNoteFields, {
      fields: [debitNoteCompanyDetails.debitNoteFieldId],
      references: [debitNoteFields.id],
    }),
    metadata: many(debitNoteCompanyDetailsMetadata),
  })
);

export const debitNoteCompanyDetailsMetadataRelations = relations(
  debitNoteCompanyDetailsMetadata,
  ({ one }) => ({
    companyDetails: one(debitNoteCompanyDetails, {
      fields: [debitNoteCompanyDetailsMetadata.debitNoteCompanyDetailsId],
      references: [debitNoteCompanyDetails.id],
    }),
  })
);

export const debitNoteClientDetailsRelations = relations(
  debitNoteClientDetails,
  ({ one, many }) => ({
    debitNoteField: one(debitNoteFields, {
      fields: [debitNoteClientDetails.debitNoteFieldId],
      references: [debitNoteFields.id],
    }),
    metadata: many(debitNoteClientDetailsMetadata),
  })
);

export const debitNoteClientDetailsMetadataRelations = relations(
  debitNoteClientDetailsMetadata,
  ({ one }) => ({
    clientDetails: one(debitNoteClientDetails, {
      fields: [debitNoteClientDetailsMetadata.debitNoteClientDetailsId],
      references: [debitNoteClientDetails.id],
    }),
  })
);

export const debitNoteDetailsRelations = relations(
  debitNoteDetails,
  ({ one, many }) => ({
    debitNoteField: one(debitNoteFields, {
      fields: [debitNoteDetails.debitNoteFieldId],
      references: [debitNoteFields.id],
    }),
    billingDetails: many(debitNoteDetailsBillingDetails),
  })
);

export const debitNoteDetailsBillingDetailsRelations = relations(
  debitNoteDetailsBillingDetails,
  ({ one }) => ({
    debitNoteDetails: one(debitNoteDetails, {
      fields: [debitNoteDetailsBillingDetails.debitNoteDetailsId],
      references: [debitNoteDetails.id],
    }),
  })
);

export const debitNoteItemsRelations = relations(debitNoteItems, ({ one }) => ({
  debitNoteField: one(debitNoteFields, {
    fields: [debitNoteItems.debitNoteFieldId],
    references: [debitNoteFields.id],
  }),
}));

export const debitNoteMetadataRelations = relations(
  debitNoteMetadata,
  ({ one }) => ({
    debitNoteField: one(debitNoteFields, {
      fields: [debitNoteMetadata.debitNoteFieldId],
      references: [debitNoteFields.id],
    }),
  })
);
