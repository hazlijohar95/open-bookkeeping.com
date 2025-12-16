import { z } from "zod";

// ============================================================================
// ENUMS & VALUE TYPES
// ============================================================================

/** Value type for billing calculations (percentage or fixed amount) */
export const valueTypeSchema = z.enum(["percentage", "fixed"]);
export type ValueType = z.infer<typeof valueTypeSchema>;

/** SST Tax Type for Malaysian Sales and Service Tax */
export const sstTaxTypeSchema = z.enum(["sales_tax", "service_tax"]);
export type SstTaxType = z.infer<typeof sstTaxTypeSchema>;

/** Theme mode (dark or light) */
export const themeModeSchema = z.enum(["dark", "light"]);
export type ThemeMode = z.infer<typeof themeModeSchema>;

/** Invoice template options (full set) */
export const invoiceTemplateSchema = z.enum([
  "default",
  "cynco",
  "classic",
  "zen",
  "executive",
]);
export type InvoiceTemplate = z.infer<typeof invoiceTemplateSchema>;

/** Document template options (subset for non-invoice documents) */
export const documentTemplateSchema = z.enum(["default", "cynco", "classic"]);
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;

/** Document status for invoices and bills */
export const documentStatusSchema = z.enum([
  "draft",
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/** Note reason schema (shared between credit notes and debit notes) */
export const noteReasonSchema = z.enum([
  "return",
  "discount",
  "pricing_error",
  "damaged_goods",
  "other",
]);
export type NoteReason = z.infer<typeof noteReasonSchema>;

// ============================================================================
// PAGINATION
// ============================================================================

/** Base pagination schema with limit and offset */
export const paginationBaseSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/** Optional pagination wrapper */
export const paginationSchema = paginationBaseSchema.optional();
export type PaginationInput = z.infer<typeof paginationSchema>;
export type Pagination = z.infer<typeof paginationBaseSchema>;

// ============================================================================
// ID SCHEMAS
// ============================================================================

/** ID param for route parameters */
export const idParamSchema = z.object({
  id: z.string().uuid(),
});
export type IdParam = z.infer<typeof idParamSchema>;

// ============================================================================
// DATE RANGE
// ============================================================================

/** Date range schema for filtering */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type DateRange = z.infer<typeof dateRangeSchema>;

// ============================================================================
// METADATA SCHEMAS
// ============================================================================

/**
 * Field with string key-value pairs (API version - loose validation)
 * Used for: company metadata, client metadata, payment information
 */
export const metadataItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type MetadataItem = z.infer<typeof metadataItemSchema>;

/**
 * Field with string key-value pairs (Form version - strict validation)
 * Used for: form inputs requiring non-empty values
 */
export const fieldKeyStringValuesSchema = z.object({
  label: z.string().min(1, { message: "Label cannot be empty" }),
  value: z.string().min(1, { message: "Value cannot be empty" }),
});
export type FieldKeyStringValues = z.infer<typeof fieldKeyStringValuesSchema>;

/**
 * Billing detail schema (API version - loose validation)
 * Used for: discounts, taxes, additional charges
 */
export const billingDetailSchema = z.object({
  label: z.string(),
  type: valueTypeSchema,
  value: z.number(),
  // SST fields for Malaysian Sales and Service Tax
  isSstTax: z.boolean().optional(),
  sstTaxType: sstTaxTypeSchema.optional(),
  sstRateCode: z.string().optional(),
});
export type BillingDetail = z.infer<typeof billingDetailSchema>;

/**
 * Billing detail schema (Form version - strict validation)
 * Used for: form inputs requiring non-empty labels
 */
export const fieldKeyNumberValuesSchema = z.object({
  label: z.string().min(1, { message: "Label cannot be empty" }),
  value: z.number(),
  type: valueTypeSchema,
  // SST fields for Malaysian Sales and Service Tax
  isSstTax: z.boolean().optional(),
  sstTaxType: sstTaxTypeSchema.optional(),
  sstRateCode: z.string().optional(), // ST_10, ST_5, ST_0, SVT_6, SVT_8
});
export type FieldKeyNumberValues = z.infer<typeof fieldKeyNumberValuesSchema>;

// ============================================================================
// DOCUMENT ITEM SCHEMAS
// ============================================================================

/**
 * Document item schema (API version - loose validation)
 * Used for: invoice items, credit note items, debit note items
 */
export const documentItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});
export type DocumentItem = z.infer<typeof documentItemSchema>;

/**
 * Document item schema (Form version - strict validation with coercion)
 * Used for: form inputs with string-to-number coercion
 */
export const documentItemFormSchema = z.object({
  name: z.string().min(1, { message: "Item name cannot be empty" }),
  description: z.string(),
  quantity: z.coerce
    .number()
    .positive({ message: "Quantity must be positive" }),
  unitPrice: z.coerce
    .number()
    .positive({ message: "Unit price must be positive" }),
});
export type DocumentItemForm = z.infer<typeof documentItemFormSchema>;

// Alias for backward compatibility
export const invoiceItemSchema = documentItemSchema;
export type InvoiceItem = DocumentItem;

// ============================================================================
// THEME SCHEMAS
// ============================================================================

/**
 * Theme schema (API version - loose validation)
 * Used for: API storage and retrieval
 */
export const themeSchema = z.object({
  baseColor: z.string(),
  mode: themeModeSchema,
  template: invoiceTemplateSchema.optional(),
});
export type Theme = z.infer<typeof themeSchema>;

/**
 * Invoice theme schema (Form version - strict validation)
 * Full 5 template options for invoices
 */
export const invoiceThemeSchema = z.object({
  baseColor: z.string().min(1, { message: "Base color cannot be empty" }),
  mode: themeModeSchema,
  template: invoiceTemplateSchema.default("default").optional(),
});
export type InvoiceTheme = z.infer<typeof invoiceThemeSchema>;

/**
 * Document theme schema (Form version - strict validation)
 * Limited 3 template options for non-invoice documents
 */
export const documentThemeSchema = z.object({
  baseColor: z.string().min(1, { message: "Base color cannot be empty" }),
  mode: themeModeSchema,
  template: documentTemplateSchema.default("default").optional(),
});
export type DocumentTheme = z.infer<typeof documentThemeSchema>;

// ============================================================================
// COMPANY & CLIENT DETAILS
// ============================================================================

/**
 * Company details schema (API version - loose validation)
 * Used for: API storage and retrieval
 */
export const companyDetailsSchema = z.object({
  name: z.string(),
  address: z.string(),
  logo: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  metadata: z.array(metadataItemSchema).optional(),
});
export type CompanyDetails = z.infer<typeof companyDetailsSchema>;

/**
 * Company details schema (Form version - with base64 support)
 * Used for: form inputs with image upload
 */
export const companyDetailsFormSchema = z.object({
  logoBase64: z.string().optional(),
  logo: z.string().nullable().optional(),
  signatureBase64: z.string().optional(),
  signature: z.string().nullable().optional(),
  name: z.string().min(1, { message: "Company name cannot be empty" }),
  address: z.string(),
  metadata: z.array(fieldKeyStringValuesSchema),
});
export type CompanyDetailsForm = z.infer<typeof companyDetailsFormSchema>;

/**
 * Client details schema (API version - loose validation)
 * Used for: API storage and retrieval
 */
export const clientDetailsSchema = z.object({
  name: z.string(),
  address: z.string(),
  metadata: z.array(metadataItemSchema).optional(),
});
export type ClientDetails = z.infer<typeof clientDetailsSchema>;

/**
 * Client details schema (Form version - strict validation)
 * Used for: form inputs
 */
export const clientDetailsFormSchema = z.object({
  name: z.string().min(1, { message: "Client name cannot be empty" }),
  address: z.string(),
  metadata: z.array(fieldKeyStringValuesSchema),
});
export type ClientDetailsForm = z.infer<typeof clientDetailsFormSchema>;

// ============================================================================
// DOCUMENT METADATA SCHEMAS
// ============================================================================

/**
 * Document metadata schema (basic - notes and terms only)
 * Used for: credit notes, debit notes
 */
export const documentMetadataSchema = z.object({
  notes: z.string(),
  terms: z.string(),
});
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

/**
 * Document metadata schema (with payment information)
 * Used for: invoices, quotations
 */
export const documentMetadataWithPaymentInfoSchema = z.object({
  notes: z.string(),
  terms: z.string(),
  paymentInformation: z.array(fieldKeyStringValuesSchema),
});
export type DocumentMetadataWithPaymentInfo = z.infer<
  typeof documentMetadataWithPaymentInfoSchema
>;

// Alias for backward compatibility
export const invoiceMetadataSchema = documentMetadataWithPaymentInfoSchema;
export type InvoiceMetadata = DocumentMetadataWithPaymentInfo;

// ============================================================================
// INVOICE DETAILS SCHEMA
// ============================================================================

/** Invoice details schema for full invoice structure */
export const invoiceDetailsSchema = z.object({
  theme: themeSchema.optional().default({
    baseColor: "#2563EB",
    mode: "light",
    template: "default",
  }),
  currency: z.string().default("USD"),
  prefix: z.string().default("INV-"),
  serialNumber: z.string().default("0001"),
  date: z.date().default(() => new Date()),
  dueDate: z.date().nullable().optional(),
  paymentTerms: z.string().optional().default(""),
  billingDetails: z.array(billingDetailSchema).optional().default([]),
});
export type InvoiceDetails = z.infer<typeof invoiceDetailsSchema>;

// ============================================================================
// COMPLETE INVOICE SCHEMA
// ============================================================================

/** Complete invoice schema for creation */
export const createInvoiceSchema = z.object({
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  invoiceDetails: invoiceDetailsSchema,
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  metadata: invoiceMetadataSchema.optional().default({
    notes: "",
    terms: "",
    paymentInformation: [],
  }),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/** Default company details (Malaysian format) */
export const defaultCompanyDetails = {
  name: "Your Company Sdn Bhd",
  address: "No. 123, Jalan Bukit Bintang\n55100 Kuala Lumpur, Malaysia",
  metadata: [],
};

/** Default client details (Malaysian format) */
export const defaultClientDetails = {
  name: "Client Name",
  address: "No. 456, Jalan Sultan Ismail\n50250 Kuala Lumpur, Malaysia",
  metadata: [],
};

/** Default theme settings */
export const defaultTheme = {
  template: "default" as const,
  baseColor: "#2563EB",
  mode: "light" as const,
};

/** Default values for a new invoice */
export const defaultInvoiceValues: CreateInvoiceInput = {
  companyDetails: {
    name: "Your Company Name",
    address: "123 Main St, City, Country",
    logo: null,
    signature: null,
    metadata: [],
  },
  clientDetails: {
    name: "Client Name",
    address: "456 Client St, City, Country",
    metadata: [],
  },
  invoiceDetails: {
    theme: {
      baseColor: "#2563EB",
      mode: "light",
      template: "default",
    },
    currency: "USD",
    prefix: "INV-",
    serialNumber: "0001",
    date: new Date(),
    dueDate: null,
    paymentTerms: "Net 30",
    billingDetails: [],
  },
  items: [
    {
      name: "Service/Product",
      description: "Description of the service or product",
      quantity: 1,
      unitPrice: 100,
    },
  ],
  metadata: {
    notes: "",
    terms: "",
    paymentInformation: [],
  },
};
