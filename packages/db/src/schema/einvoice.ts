import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { invoices } from "./invoices";
import { users } from "./users";

// E-Invoice submission status enum
export const einvoiceSubmissionStatusEnum = pgEnum("einvoice_submission_status", [
  "pending",      // Submission created, waiting to be sent
  "submitted",    // Sent to MyInvois, awaiting validation
  "valid",        // Validated and accepted by MyInvois
  "invalid",      // Rejected by MyInvois due to validation errors
  "cancelled",    // Cancelled after being valid
]);

// Identification scheme enum for Malaysia
export const identificationSchemeEnum = pgEnum("identification_scheme", [
  "NRIC",      // Malaysian IC Number
  "BRN",       // Business Registration Number
  "PASSPORT",  // Passport Number
  "ARMY",      // Army ID
]);

// Tax category code enum
export const taxCategoryCodeEnum = pgEnum("tax_category_code", [
  "01",  // Sales Tax
  "02",  // Service Tax
  "03",  // Tourism Tax
  "04",  // High-Value Goods Tax
  "05",  // Sales Tax on Low Value Goods
  "06",  // Not Applicable
  "E",   // Exempt
]);

// Document type for e-invoice
export const einvoiceDocumentTypeEnum = pgEnum("einvoice_document_type", [
  "invoice",
  "credit_note",
  "debit_note",
  "refund_note",
  "self_billed_invoice",
  "self_billed_credit_note",
  "self_billed_debit_note",
  "self_billed_refund_note",
]);

// TypeScript types for enums
export type EInvoiceSubmissionStatus = (typeof einvoiceSubmissionStatusEnum.enumValues)[number];
export type IdentificationScheme = (typeof identificationSchemeEnum.enumValues)[number];
export type TaxCategoryCode = (typeof taxCategoryCodeEnum.enumValues)[number];
export type EInvoiceDocumentType = (typeof einvoiceDocumentTypeEnum.enumValues)[number];

// E-Invoice settings per user
export const einvoiceSettings = pgTable("einvoice_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),

  // Feature toggles
  enabled: boolean("enabled").default(false).notNull(),
  autoSubmit: boolean("auto_submit").default(false).notNull(),

  // Business identification
  tin: varchar("tin", { length: 20 }),  // Tax Identification Number (C followed by 10 digits)
  brn: varchar("brn", { length: 30 }),  // Business Registration Number
  identificationScheme: identificationSchemeEnum("identification_scheme"),

  // Industry classification (MSIC)
  msicCode: varchar("msic_code", { length: 5 }),
  msicDescription: varchar("msic_description", { length: 255 }),

  // Tax registrations
  sstRegistration: varchar("sst_registration", { length: 50 }),
  tourismTaxRegistration: varchar("tourism_tax_registration", { length: 50 }),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// E-Invoice submissions tracking
export const einvoiceSubmissions = pgTable(
  "einvoice_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Link to source document (invoice, credit note, etc.)
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    // Note: For credit notes, debit notes, etc., we can add additional foreign keys as needed
    // or use a polymorphic approach with documentType + documentId

    documentType: einvoiceDocumentTypeEnum("document_type").notNull(),

    // MyInvois identifiers
    submissionUid: varchar("submission_uid", { length: 50 }),  // UUID returned by MyInvois on submission
    documentUuid: varchar("document_uuid", { length: 50 }),    // UUID of the document in MyInvois
    longId: varchar("long_id", { length: 100 }),               // Long ID for QR code generation

    // Status tracking
    status: einvoiceSubmissionStatusEnum("status").default("pending").notNull(),

    // Timestamps
    submittedAt: timestamp("submitted_at"),
    validatedAt: timestamp("validated_at"),
    cancelledAt: timestamp("cancelled_at"),

    // Error handling
    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),

    // Raw API responses for debugging
    rawRequest: jsonb("raw_request"),
    rawResponse: jsonb("raw_response"),

    // Audit timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("einvoice_submissions_invoice_id_idx").on(table.invoiceId),
    index("einvoice_submissions_status_idx").on(table.status),
    index("einvoice_submissions_submission_uid_idx").on(table.submissionUid),
    index("einvoice_submissions_document_uuid_idx").on(table.documentUuid),
  ]
);

// Relations
export const einvoiceSettingsRelations = relations(einvoiceSettings, ({ one }) => ({
  user: one(users, {
    fields: [einvoiceSettings.userId],
    references: [users.id],
  }),
}));

export const einvoiceSubmissionsRelations = relations(einvoiceSubmissions, ({ one }) => ({
  invoice: one(invoices, {
    fields: [einvoiceSubmissions.invoiceId],
    references: [invoices.id],
  }),
}));
