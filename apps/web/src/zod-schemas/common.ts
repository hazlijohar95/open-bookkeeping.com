import { z } from "zod";

// ============= Common Enums =============

export const valueTypeSchema = z.enum(["percentage", "fixed"]);

export const noteReasonSchema = z.enum([
  "return",
  "discount",
  "pricing_error",
  "damaged_goods",
  "other",
]);

export const themeModeSchema = z.enum(["dark", "light"]);

// Invoice has all 5 templates
export const invoiceTemplateSchema = z.enum([
  "default",
  "cynco",
  "classic",
  "zen",
  "executive",
]);

// Other document types only have 3 templates
export const documentTemplateSchema = z.enum(["default", "cynco", "classic"]);

// ============= Shared Field Schemas =============

export const fieldKeyStringValuesSchema = z.object({
  label: z.string().min(1, { message: "Label cannot be empty" }),
  value: z.string().min(1, { message: "Value cannot be empty" }),
});

// SST Tax Type enum for Malaysian Sales and Service Tax
export const sstTaxTypeSchema = z.enum(["sales_tax", "service_tax"]);

export const fieldKeyNumberValuesSchema = z.object({
  label: z.string().min(1, { message: "Label cannot be empty" }),
  value: z.number(),
  type: valueTypeSchema,
  // SST fields for Malaysian Sales and Service Tax
  isSstTax: z.boolean().optional(),
  sstTaxType: sstTaxTypeSchema.optional(),
  sstRateCode: z.string().optional(), // ST_10, ST_5, ST_0, SVT_6, SVT_8
});

// ============= Document Item Schema =============

export const documentItemSchema = z.object({
  name: z.string().min(1, { message: "Item name cannot be empty" }),
  description: z.string(),
  quantity: z.coerce.number().positive({ message: "Quantity must be positive" }),
  unitPrice: z.coerce.number().positive({ message: "Unit price must be positive" }),
});

// ============= Image URL Validator =============

const isProduction = typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  !window.location.hostname.includes("127.0.0.1");

const imageUrlRefine = (val: string | null | undefined) => {
  if (!val) return true;

  // Always allow data URLs and blob URLs
  if (val.startsWith("data:image") || val.startsWith("blob:")) {
    return true;
  }

  // In production, require HTTPS
  if (isProduction) {
    return val.startsWith("https://");
  }

  // In development, allow both HTTP and HTTPS
  return val.startsWith("https://") || val.startsWith("http://");
};

// ============= Company Details Schema =============

export const companyDetailsSchema = z.object({
  logoBase64: z.string().optional(),
  logo: z
    .string()
    .refine(imageUrlRefine, {
      message: "Logo must be a valid image URL, blob URL or data URL",
    })
    .nullable()
    .optional(),
  signatureBase64: z.string().optional(),
  signature: z
    .string()
    .refine(imageUrlRefine, {
      message: "Signature must be a valid image URL, blob URL or data URL",
    })
    .nullable()
    .optional(),
  name: z.string().min(1, { message: "Company name cannot be empty" }),
  address: z.string(),
  metadata: z.array(fieldKeyStringValuesSchema),
});

// ============= Client Details Schema =============

export const clientDetailsSchema = z.object({
  name: z.string().min(1, { message: "Client name cannot be empty" }),
  address: z.string(),
  metadata: z.array(fieldKeyStringValuesSchema),
});

// ============= Theme Schemas =============

// Invoice theme with all 5 templates
export const invoiceThemeSchema = z.object({
  baseColor: z.string().min(1, { message: "Base color cannot be empty" }),
  mode: themeModeSchema,
  template: invoiceTemplateSchema.default("default").optional(),
});

// Other document types with 3 templates
export const documentThemeSchema = z.object({
  baseColor: z.string().min(1, { message: "Base color cannot be empty" }),
  mode: themeModeSchema,
  template: documentTemplateSchema.default("default").optional(),
});

// Alias for backward compatibility
export const themeSchema = invoiceThemeSchema;

// ============= Document Metadata Schema =============

export const documentMetadataSchema = z.object({
  notes: z.string(),
  terms: z.string(),
});

export const documentMetadataWithPaymentInfoSchema = z.object({
  notes: z.string(),
  terms: z.string(),
  paymentInformation: z.array(fieldKeyStringValuesSchema),
});

// ============= Default Values =============

export const defaultCompanyDetails = {
  name: "Your Company Sdn Bhd",
  address: "No. 123, Jalan Bukit Bintang\n55100 Kuala Lumpur, Malaysia",
  metadata: [],
};

export const defaultClientDetails = {
  name: "Client Name",
  address: "No. 456, Jalan Sultan Ismail\n50250 Kuala Lumpur, Malaysia",
  metadata: [],
};

export const defaultTheme = {
  template: "default" as const,
  baseColor: "#2563EB",
  mode: "light" as const,
};

// ============= Type Exports =============

export type ValueType = z.infer<typeof valueTypeSchema>;
export type NoteReason = z.infer<typeof noteReasonSchema>;
export type SstTaxType = z.infer<typeof sstTaxTypeSchema>;
export type FieldKeyStringValues = z.infer<typeof fieldKeyStringValuesSchema>;
export type FieldKeyNumberValues = z.infer<typeof fieldKeyNumberValuesSchema>;
export type DocumentItem = z.infer<typeof documentItemSchema>;
export type CompanyDetails = z.infer<typeof companyDetailsSchema>;
export type ClientDetails = z.infer<typeof clientDetailsSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type DocumentMetadataWithPaymentInfo = z.infer<
  typeof documentMetadataWithPaymentInfoSchema
>;
