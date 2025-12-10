import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  varchar,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { customers } from "./customers";
import { vendors } from "./vendors";
import {
  invoiceTypeEnum,
  invoiceStatusEnum,
  billingDetailTypeEnum,
  sstTaxTypeEnum,
} from "./enums";

// Re-export enums for backward compatibility
export { invoiceTypeEnum, invoiceStatusEnum, billingDetailTypeEnum };

// Main invoice table
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Link to customer/vendor for statement of accounts
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),
    type: invoiceTypeEnum("type").default("server").notNull(),
    status: invoiceStatusEnum("status").default("pending").notNull(),
    // E-Invoice status for Malaysia MyInvois
    // Values: null (not submitted), pending, submitted, valid, invalid, cancelled
    einvoiceStatus: varchar("einvoice_status", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("invoices_user_id_idx").on(table.userId),
    index("invoices_customer_id_idx").on(table.customerId),
    index("invoices_vendor_id_idx").on(table.vendorId),
    index("invoices_status_idx").on(table.status),
    // Composite indexes for common query patterns
    index("invoices_user_status_idx").on(table.userId, table.status),
    index("invoices_user_created_idx").on(table.userId, table.createdAt),
    index("invoices_user_deleted_idx").on(table.userId, table.deletedAt),
    // Additional composite indexes for performance
    index("invoices_user_customer_created_idx").on(table.userId, table.customerId, table.createdAt),
    index("invoices_user_paid_idx").on(table.userId, table.paidAt),
  ]
);

// Invoice fields - one-to-one with invoices
export const invoiceFields = pgTable("invoice_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
});

// Company details
export const invoiceCompanyDetails = pgTable("invoice_company_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceFieldId: uuid("invoice_field_id")
    .references(() => invoiceFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  logo: text("logo"),
  signature: text("signature"),
});

export const invoiceCompanyDetailsMetadata = pgTable(
  "invoice_company_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceCompanyDetailsId: uuid("invoice_company_details_id")
      .references(() => invoiceCompanyDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Client details
export const invoiceClientDetails = pgTable("invoice_client_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceFieldId: uuid("invoice_field_id")
    .references(() => invoiceFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
});

export const invoiceClientDetailsMetadata = pgTable(
  "invoice_client_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceClientDetailsId: uuid("invoice_client_details_id")
      .references(() => invoiceClientDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Invoice details (dates, currency, etc.)
export const invoiceDetails = pgTable("invoice_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceFieldId: uuid("invoice_field_id")
    .references(() => invoiceFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  theme: jsonb("theme").$type<{
    baseColor: string;
    mode: "dark" | "light";
    template?: "default" | "cynco" | "classic" | "zen" | "executive";
  }>(),
  currency: text("currency").notNull(),
  prefix: text("prefix").notNull(),
  serialNumber: text("serial_number").notNull(),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date"),
  paymentTerms: text("payment_terms"),
});

export const invoiceDetailsBillingDetails = pgTable(
  "invoice_details_billing_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceDetailsId: uuid("invoice_details_id")
      .references(() => invoiceDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    type: billingDetailTypeEnum("type").notNull(),
    value: numeric("value", { precision: 15, scale: 2 }).notNull(),
    // SST-specific fields for Malaysian Sales and Service Tax
    isSstTax: boolean("is_sst_tax").default(false),
    sstTaxType: sstTaxTypeEnum("sst_tax_type"),
    sstRateCode: varchar("sst_rate_code", { length: 20 }), // ST_10, ST_5, SVT_6, SVT_8
  }
);

// Invoice items (line items)
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceFieldId: uuid("invoice_field_id")
    .references(() => invoiceFields.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
});

// Invoice metadata (notes, terms)
export const invoiceMetadata = pgTable("invoice_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceFieldId: uuid("invoice_field_id")
    .references(() => invoiceFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  notes: text("notes"),
  terms: text("terms"),
});

export const invoiceMetadataPaymentInformation = pgTable(
  "invoice_metadata_payment_information",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceMetadataId: uuid("invoice_metadata_id")
      .references(() => invoiceMetadata.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Relations
export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  vendor: one(vendors, {
    fields: [invoices.vendorId],
    references: [vendors.id],
  }),
  invoiceFields: one(invoiceFields),
}));

export const invoiceFieldsRelations = relations(invoiceFields, ({ one, many }) => ({
  invoice: one(invoices, {
    fields: [invoiceFields.invoiceId],
    references: [invoices.id],
  }),
  companyDetails: one(invoiceCompanyDetails),
  clientDetails: one(invoiceClientDetails),
  invoiceDetails: one(invoiceDetails),
  items: many(invoiceItems),
  metadata: one(invoiceMetadata),
}));

export const invoiceCompanyDetailsRelations = relations(
  invoiceCompanyDetails,
  ({ one, many }) => ({
    invoiceField: one(invoiceFields, {
      fields: [invoiceCompanyDetails.invoiceFieldId],
      references: [invoiceFields.id],
    }),
    metadata: many(invoiceCompanyDetailsMetadata),
  })
);

export const invoiceCompanyDetailsMetadataRelations = relations(
  invoiceCompanyDetailsMetadata,
  ({ one }) => ({
    companyDetails: one(invoiceCompanyDetails, {
      fields: [invoiceCompanyDetailsMetadata.invoiceCompanyDetailsId],
      references: [invoiceCompanyDetails.id],
    }),
  })
);

export const invoiceClientDetailsRelations = relations(
  invoiceClientDetails,
  ({ one, many }) => ({
    invoiceField: one(invoiceFields, {
      fields: [invoiceClientDetails.invoiceFieldId],
      references: [invoiceFields.id],
    }),
    metadata: many(invoiceClientDetailsMetadata),
  })
);

export const invoiceClientDetailsMetadataRelations = relations(
  invoiceClientDetailsMetadata,
  ({ one }) => ({
    clientDetails: one(invoiceClientDetails, {
      fields: [invoiceClientDetailsMetadata.invoiceClientDetailsId],
      references: [invoiceClientDetails.id],
    }),
  })
);

export const invoiceDetailsRelations = relations(
  invoiceDetails,
  ({ one, many }) => ({
    invoiceField: one(invoiceFields, {
      fields: [invoiceDetails.invoiceFieldId],
      references: [invoiceFields.id],
    }),
    billingDetails: many(invoiceDetailsBillingDetails),
  })
);

export const invoiceDetailsBillingDetailsRelations = relations(
  invoiceDetailsBillingDetails,
  ({ one }) => ({
    invoiceDetails: one(invoiceDetails, {
      fields: [invoiceDetailsBillingDetails.invoiceDetailsId],
      references: [invoiceDetails.id],
    }),
  })
);

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoiceField: one(invoiceFields, {
    fields: [invoiceItems.invoiceFieldId],
    references: [invoiceFields.id],
  }),
}));

export const invoiceMetadataRelations = relations(
  invoiceMetadata,
  ({ one, many }) => ({
    invoiceField: one(invoiceFields, {
      fields: [invoiceMetadata.invoiceFieldId],
      references: [invoiceFields.id],
    }),
    paymentInformation: many(invoiceMetadataPaymentInformation),
  })
);

export const invoiceMetadataPaymentInformationRelations = relations(
  invoiceMetadataPaymentInformation,
  ({ one }) => ({
    metadata: one(invoiceMetadata, {
      fields: [invoiceMetadataPaymentInformation.invoiceMetadataId],
      references: [invoiceMetadata.id],
    }),
  })
);
