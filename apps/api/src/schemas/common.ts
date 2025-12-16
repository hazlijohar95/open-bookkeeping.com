/**
 * Common API Schemas
 *
 * Re-exports shared schemas from @open-bookkeeping/shared.
 * This file exists for backward compatibility and to add any API-specific schemas.
 */

// Re-export all schemas from shared package
export {
  // Enums
  valueTypeSchema,
  sstTaxTypeSchema,
  themeModeSchema,
  invoiceTemplateSchema,
  documentTemplateSchema,
  documentStatusSchema,
  noteReasonSchema,

  // Pagination
  paginationBaseSchema,
  paginationSchema,

  // ID
  idParamSchema,

  // Date Range
  dateRangeSchema,

  // Metadata
  metadataItemSchema,
  fieldKeyStringValuesSchema,
  billingDetailSchema,
  fieldKeyNumberValuesSchema,

  // Document Items
  documentItemSchema,
  documentItemFormSchema,
  invoiceItemSchema,

  // Theme
  themeSchema,
  invoiceThemeSchema,
  documentThemeSchema,

  // Company & Client Details
  companyDetailsSchema,
  companyDetailsFormSchema,
  clientDetailsSchema,
  clientDetailsFormSchema,

  // Document Metadata
  documentMetadataSchema,
  documentMetadataWithPaymentInfoSchema,
  invoiceMetadataSchema,

  // Invoice
  invoiceDetailsSchema,
  createInvoiceSchema,

  // Default Values
  defaultCompanyDetails,
  defaultClientDetails,
  defaultTheme,
  defaultInvoiceValues,

  // Types
  type ValueType,
  type SstTaxType,
  type ThemeMode,
  type InvoiceTemplate,
  type DocumentTemplate,
  type DocumentStatus,
  type NoteReason,
  type PaginationInput,
  type Pagination,
  type IdParam,
  type DateRange,
  type MetadataItem,
  type FieldKeyStringValues,
  type BillingDetail,
  type FieldKeyNumberValues,
  type DocumentItem,
  type DocumentItemForm,
  type InvoiceItem,
  type Theme,
  type InvoiceTheme,
  type DocumentTheme,
  type CompanyDetails,
  type CompanyDetailsForm,
  type ClientDetails,
  type ClientDetailsForm,
  type DocumentMetadata,
  type DocumentMetadataWithPaymentInfo,
  type InvoiceMetadata,
  type InvoiceDetails,
  type CreateInvoiceInput,
} from "@open-bookkeeping/shared";
