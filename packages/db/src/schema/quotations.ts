import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  numeric,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { invoices } from "./invoices";
import { customers } from "./customers";
import {
  quotationTypeEnum,
  quotationStatusEnum,
  billingDetailTypeEnum,
} from "./enums";

// Re-export enums for backward compatibility
export { quotationTypeEnum, quotationStatusEnum };

// Main quotation table
export const quotations = pgTable(
  "quotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    // Link to customer for statement of accounts
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    type: quotationTypeEnum("type").default("server").notNull(),
    status: quotationStatusEnum("status").default("draft").notNull(),
    validUntil: date("valid_until"),
    convertedInvoiceId: uuid("converted_invoice_id").references(
      () => invoices.id
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("quotations_user_id_idx").on(table.userId),
    index("quotations_customer_id_idx").on(table.customerId),
    index("quotations_status_idx").on(table.status),
    // Composite indexes for common query patterns
    index("quotations_user_status_idx").on(table.userId, table.status),
    index("quotations_user_created_idx").on(table.userId, table.createdAt),
    index("quotations_user_deleted_idx").on(table.userId, table.deletedAt),
  ]
);

// Quotation fields - one-to-one with quotations
export const quotationFields = pgTable("quotation_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationId: uuid("quotation_id")
    .references(() => quotations.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
});

// Company details
export const quotationCompanyDetails = pgTable("quotation_company_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationFieldId: uuid("quotation_field_id")
    .references(() => quotationFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  logo: text("logo"),
  signature: text("signature"),
});

export const quotationCompanyDetailsMetadata = pgTable(
  "quotation_company_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationCompanyDetailsId: uuid("quotation_company_details_id")
      .references(() => quotationCompanyDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Client details
export const quotationClientDetails = pgTable("quotation_client_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationFieldId: uuid("quotation_field_id")
    .references(() => quotationFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
});

export const quotationClientDetailsMetadata = pgTable(
  "quotation_client_details_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationClientDetailsId: uuid("quotation_client_details_id")
      .references(() => quotationClientDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Quotation details (dates, currency, etc.)
export const quotationDetails = pgTable("quotation_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationFieldId: uuid("quotation_field_id")
    .references(() => quotationFields.id, { onDelete: "cascade" })
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
  validUntil: timestamp("valid_until"),
  paymentTerms: text("payment_terms"),
});

export const quotationDetailsBillingDetails = pgTable(
  "quotation_details_billing_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationDetailsId: uuid("quotation_details_id")
      .references(() => quotationDetails.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    type: billingDetailTypeEnum("type").notNull(),
    value: numeric("value", { precision: 15, scale: 2 }).notNull(),
  }
);

// Quotation items (line items)
export const quotationItems = pgTable("quotation_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationFieldId: uuid("quotation_field_id")
    .references(() => quotationFields.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
});

// Quotation metadata (notes, terms)
export const quotationMetadata = pgTable("quotation_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  quotationFieldId: uuid("quotation_field_id")
    .references(() => quotationFields.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  notes: text("notes"),
  terms: text("terms"),
});

export const quotationMetadataPaymentInformation = pgTable(
  "quotation_metadata_payment_information",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quotationMetadataId: uuid("quotation_metadata_id")
      .references(() => quotationMetadata.id, { onDelete: "cascade" })
      .notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
  }
);

// Relations
export const quotationsRelations = relations(quotations, ({ one }) => ({
  user: one(users, {
    fields: [quotations.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  convertedInvoice: one(invoices, {
    fields: [quotations.convertedInvoiceId],
    references: [invoices.id],
  }),
  quotationFields: one(quotationFields),
}));

export const quotationFieldsRelations = relations(quotationFields, ({ one, many }) => ({
  quotation: one(quotations, {
    fields: [quotationFields.quotationId],
    references: [quotations.id],
  }),
  companyDetails: one(quotationCompanyDetails),
  clientDetails: one(quotationClientDetails),
  quotationDetails: one(quotationDetails),
  items: many(quotationItems),
  metadata: one(quotationMetadata),
}));

export const quotationCompanyDetailsRelations = relations(
  quotationCompanyDetails,
  ({ one, many }) => ({
    quotationField: one(quotationFields, {
      fields: [quotationCompanyDetails.quotationFieldId],
      references: [quotationFields.id],
    }),
    metadata: many(quotationCompanyDetailsMetadata),
  })
);

export const quotationCompanyDetailsMetadataRelations = relations(
  quotationCompanyDetailsMetadata,
  ({ one }) => ({
    companyDetails: one(quotationCompanyDetails, {
      fields: [quotationCompanyDetailsMetadata.quotationCompanyDetailsId],
      references: [quotationCompanyDetails.id],
    }),
  })
);

export const quotationClientDetailsRelations = relations(
  quotationClientDetails,
  ({ one, many }) => ({
    quotationField: one(quotationFields, {
      fields: [quotationClientDetails.quotationFieldId],
      references: [quotationFields.id],
    }),
    metadata: many(quotationClientDetailsMetadata),
  })
);

export const quotationClientDetailsMetadataRelations = relations(
  quotationClientDetailsMetadata,
  ({ one }) => ({
    clientDetails: one(quotationClientDetails, {
      fields: [quotationClientDetailsMetadata.quotationClientDetailsId],
      references: [quotationClientDetails.id],
    }),
  })
);

export const quotationDetailsRelations = relations(
  quotationDetails,
  ({ one, many }) => ({
    quotationField: one(quotationFields, {
      fields: [quotationDetails.quotationFieldId],
      references: [quotationFields.id],
    }),
    billingDetails: many(quotationDetailsBillingDetails),
  })
);

export const quotationDetailsBillingDetailsRelations = relations(
  quotationDetailsBillingDetails,
  ({ one }) => ({
    quotationDetails: one(quotationDetails, {
      fields: [quotationDetailsBillingDetails.quotationDetailsId],
      references: [quotationDetails.id],
    }),
  })
);

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotationField: one(quotationFields, {
    fields: [quotationItems.quotationFieldId],
    references: [quotationFields.id],
  }),
}));

export const quotationMetadataRelations = relations(
  quotationMetadata,
  ({ one, many }) => ({
    quotationField: one(quotationFields, {
      fields: [quotationMetadata.quotationFieldId],
      references: [quotationFields.id],
    }),
    paymentInformation: many(quotationMetadataPaymentInformation),
  })
);

export const quotationMetadataPaymentInformationRelations = relations(
  quotationMetadataPaymentInformation,
  ({ one }) => ({
    metadata: one(quotationMetadata, {
      fields: [quotationMetadataPaymentInformation.quotationMetadataId],
      references: [quotationMetadata.id],
    }),
  })
);
