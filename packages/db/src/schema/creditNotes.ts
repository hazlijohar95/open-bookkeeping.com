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
  creditNoteTypeEnum,
  creditNoteStatusEnum,
  noteReasonEnum,
  billingDetailTypeEnum,
} from "./enums";

// Re-export enums for backward compatibility
export { creditNoteTypeEnum, creditNoteStatusEnum, noteReasonEnum };

// Main credit note table
export const creditNotes = pgTable(
  "credit_notes",
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
    type: creditNoteTypeEnum("type").default("server").notNull(),
    status: creditNoteStatusEnum("status").default("draft").notNull(),
    reason: noteReasonEnum("reason").notNull(),
    reasonDescription: text("reason_description"), // For "other" reason
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    issuedAt: timestamp("issued_at"), // Set when status = "issued"
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("credit_notes_user_id_idx").on(table.userId),
    index("credit_notes_invoice_id_idx").on(table.invoiceId),
    index("credit_notes_customer_id_idx").on(table.customerId),
    index("credit_notes_vendor_id_idx").on(table.vendorId),
    index("credit_notes_status_idx").on(table.status),
    // Composite indexes for common query patterns
    index("credit_notes_user_status_idx").on(table.userId, table.status),
    index("credit_notes_user_created_idx").on(table.userId, table.createdAt),
    index("credit_notes_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
);

// Credit note fields - one-to-one with credit_notes (hub)
export const creditNoteFields = pgTable("credit_note_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteId: uuid("credit_note_id")
    .references(() => creditNotes.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
});

// Company details
export const creditNoteCompanyDetails = pgTable("credit_note_company_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteFieldId: uuid("credit_note_field_id")
    .references(() => creditNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  logo: text("logo"),
  signature: text("signature"),
});

export const creditNoteCompanyDetailsMetadata = pgTable(
  "credit_note_company_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteCompanyDetailsId: uuid("credit_note_company_details_id")
      .references(() => creditNoteCompanyDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Client details
export const creditNoteClientDetails = pgTable("credit_note_client_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteFieldId: uuid("credit_note_field_id")
    .references(() => creditNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
});

export const creditNoteClientDetailsMetadata = pgTable(
  "credit_note_client_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteClientDetailsId: uuid("credit_note_client_details_id")
      .references(() => creditNoteClientDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Credit note details (dates, currency, etc.)
export const creditNoteDetails = pgTable("credit_note_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteFieldId: uuid("credit_note_field_id")
    .references(() => creditNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  theme: jsonb("theme").$type<{
    baseColor: string;
    mode: "dark" | "light";
    template?: "default" | "cynco" | "classic" | "zen" | "executive";
  }>(),
  currency: text("currency").notNull(),
  prefix: text("prefix").notNull().default("CN-"),
  serialNumber: text("serial_number").notNull(),
  date: timestamp("date").notNull(),
  // Reference to original invoice number (for display purposes)
  originalInvoiceNumber: text("original_invoice_number"),
});

export const creditNoteDetailsBillingDetails = pgTable(
  "credit_note_details_billing_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creditNoteDetailsId: uuid("credit_note_details_id")
      .references(() => creditNoteDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    type: billingDetailTypeEnum("type").notNull(),
    value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  }
);

// Credit note items (line items)
export const creditNoteItems = pgTable("credit_note_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteFieldId: uuid("credit_note_field_id")
    .references(() => creditNoteFields.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
});

// Credit note metadata (notes, terms)
export const creditNoteMetadata = pgTable("credit_note_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  creditNoteFieldId: uuid("credit_note_field_id")
    .references(() => creditNoteFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  notes: text("notes"),
  terms: text("terms"),
});

// Relations
export const creditNotesRelations = relations(creditNotes, ({ one }) => ({
  user: one(users, {
    fields: [creditNotes.userId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [creditNotes.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [creditNotes.customerId],
    references: [customers.id],
  }),
  vendor: one(vendors, {
    fields: [creditNotes.vendorId],
    references: [vendors.id],
  }),
  creditNoteFields: one(creditNoteFields),
}));

export const creditNoteFieldsRelations = relations(
  creditNoteFields,
  ({ one, many }) => ({
    creditNote: one(creditNotes, {
      fields: [creditNoteFields.creditNoteId],
      references: [creditNotes.id],
    }),
    companyDetails: one(creditNoteCompanyDetails),
    clientDetails: one(creditNoteClientDetails),
    creditNoteDetails: one(creditNoteDetails),
    items: many(creditNoteItems),
    metadata: one(creditNoteMetadata),
  })
);

export const creditNoteCompanyDetailsRelations = relations(
  creditNoteCompanyDetails,
  ({ one, many }) => ({
    creditNoteField: one(creditNoteFields, {
      fields: [creditNoteCompanyDetails.creditNoteFieldId],
      references: [creditNoteFields.id],
    }),
    metadata: many(creditNoteCompanyDetailsMetadata),
  })
);

export const creditNoteCompanyDetailsMetadataRelations = relations(
  creditNoteCompanyDetailsMetadata,
  ({ one }) => ({
    companyDetails: one(creditNoteCompanyDetails, {
      fields: [creditNoteCompanyDetailsMetadata.creditNoteCompanyDetailsId],
      references: [creditNoteCompanyDetails.id],
    }),
  })
);

export const creditNoteClientDetailsRelations = relations(
  creditNoteClientDetails,
  ({ one, many }) => ({
    creditNoteField: one(creditNoteFields, {
      fields: [creditNoteClientDetails.creditNoteFieldId],
      references: [creditNoteFields.id],
    }),
    metadata: many(creditNoteClientDetailsMetadata),
  })
);

export const creditNoteClientDetailsMetadataRelations = relations(
  creditNoteClientDetailsMetadata,
  ({ one }) => ({
    clientDetails: one(creditNoteClientDetails, {
      fields: [creditNoteClientDetailsMetadata.creditNoteClientDetailsId],
      references: [creditNoteClientDetails.id],
    }),
  })
);

export const creditNoteDetailsRelations = relations(
  creditNoteDetails,
  ({ one, many }) => ({
    creditNoteField: one(creditNoteFields, {
      fields: [creditNoteDetails.creditNoteFieldId],
      references: [creditNoteFields.id],
    }),
    billingDetails: many(creditNoteDetailsBillingDetails),
  })
);

export const creditNoteDetailsBillingDetailsRelations = relations(
  creditNoteDetailsBillingDetails,
  ({ one }) => ({
    creditNoteDetails: one(creditNoteDetails, {
      fields: [creditNoteDetailsBillingDetails.creditNoteDetailsId],
      references: [creditNoteDetails.id],
    }),
  })
);

export const creditNoteItemsRelations = relations(
  creditNoteItems,
  ({ one }) => ({
    creditNoteField: one(creditNoteFields, {
      fields: [creditNoteItems.creditNoteFieldId],
      references: [creditNoteFields.id],
    }),
  })
);

export const creditNoteMetadataRelations = relations(
  creditNoteMetadata,
  ({ one }) => ({
    creditNoteField: one(creditNoteFields, {
      fields: [creditNoteMetadata.creditNoteFieldId],
      references: [creditNoteFields.id],
    }),
  })
);
