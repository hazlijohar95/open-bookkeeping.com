import { z } from "zod";

// Re-export all schemas from shared package
export {
  // Enums
  valueTypeSchema,
  sstTaxTypeSchema,
  themeModeSchema,
  invoiceTemplateSchema,
  documentTemplateSchema,
  noteReasonSchema,

  // Metadata
  metadataItemSchema,
  fieldKeyStringValuesSchema,
  fieldKeyNumberValuesSchema,

  // Document Items
  documentItemSchema,

  // Theme (base schemas)
  themeSchema,
  invoiceThemeSchema,
  documentThemeSchema,

  // Document Metadata
  documentMetadataSchema,
  documentMetadataWithPaymentInfoSchema,

  // Default Values
  defaultCompanyDetails,
  defaultClientDetails,
  defaultTheme,

  // Types
  type ValueType,
  type NoteReason,
  type SstTaxType,
  type FieldKeyStringValues,
  type FieldKeyNumberValues,
  type DocumentItem,
  type Theme,
  type DocumentMetadata,
  type DocumentMetadataWithPaymentInfo,
} from "@open-bookkeeping/shared";

// ============= Image URL Validator (Frontend-specific) =============

const isProduction =
  typeof window !== "undefined" &&
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

// ============= Company Details Schema (with frontend image validation) =============

import { fieldKeyStringValuesSchema } from "@open-bookkeeping/shared";

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

// ============= Type Exports =============

export type CompanyDetails = z.infer<typeof companyDetailsSchema>;
export type ClientDetails = z.infer<typeof clientDetailsSchema>;
