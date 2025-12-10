import { z } from "zod";

// ============= Common Pagination Schema =============

export const paginationBaseSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const paginationSchema = paginationBaseSchema.optional();

export type PaginationInput = z.infer<typeof paginationSchema>;

// ============= Common ID Schemas =============

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export type IdParam = z.infer<typeof idParamSchema>;

// ============= Common Status Schemas =============

export const documentStatusSchema = z.enum(["draft", "pending", "paid", "overdue", "cancelled"]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

// ============= Note Reason Schema (for credit/debit notes) =============

export const noteReasonSchema = z.enum(["return", "discount", "pricing_error", "damaged_goods", "other"]);
export type NoteReason = z.infer<typeof noteReasonSchema>;

// ============= Common Metadata Schemas =============

export const metadataItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export type MetadataItem = z.infer<typeof metadataItemSchema>;

export const billingDetailSchema = z.object({
  label: z.string(),
  type: z.enum(["fixed", "percentage"]),
  value: z.number(),
  // SST fields for Malaysian Sales and Service Tax
  isSstTax: z.boolean().optional(),
  sstTaxType: z.enum(["sales_tax", "service_tax"]).optional(),
  sstRateCode: z.string().optional(),
});

export type BillingDetail = z.infer<typeof billingDetailSchema>;

// ============= Common Theme Schema =============

export const themeSchema = z.object({
  baseColor: z.string(),
  mode: z.enum(["dark", "light"]),
  template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
});

export type Theme = z.infer<typeof themeSchema>;

// ============= Common Item Schema =============

export const documentItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

export type DocumentItem = z.infer<typeof documentItemSchema>;

// ============= Common Company/Client Details =============

export const companyDetailsSchema = z.object({
  name: z.string(),
  address: z.string(),
  logo: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  metadata: z.array(metadataItemSchema).optional(),
});

export type CompanyDetails = z.infer<typeof companyDetailsSchema>;

export const clientDetailsSchema = z.object({
  name: z.string(),
  address: z.string(),
  metadata: z.array(metadataItemSchema).optional(),
});

export type ClientDetails = z.infer<typeof clientDetailsSchema>;

// ============= Date Range Schema =============

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
