import { z } from "zod";
import {
  valueTypeSchema,
  fieldKeyStringValuesSchema,
  fieldKeyNumberValuesSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
  documentThemeSchema,
  documentMetadataWithPaymentInfoSchema,
  defaultCompanyDetails,
  defaultClientDetails,
  defaultTheme,
} from "../common";

// Re-export shared schemas for backward compatibility
export const valueType = valueTypeSchema;
export const createQuotationItemSchema = documentItemSchema;
export const createQuotationFieldKeyStringValuesSchema = fieldKeyStringValuesSchema;
export const createQuotationFieldKeyNumberValuesSchema = fieldKeyNumberValuesSchema;

export const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  quotationDetails: z.object({
    theme: documentThemeSchema,
    currency: z.string().min(1, { message: "Currency cannot be empty" }),
    prefix: z.string(),
    serialNumber: z.string().min(1, { message: "Serial number cannot be empty" }),
    date: z.date(),
    validUntil: z.date().optional().nullable(),
    paymentTerms: z.string(),
    billingDetails: z.array(fieldKeyNumberValuesSchema),
  }),
  items: z.array(documentItemSchema),
  metadata: documentMetadataWithPaymentInfoSchema,
});

export type ZodCreateQuotationSchema = z.infer<typeof createQuotationSchema>;

export const createQuotationSchemaDefaultValues: ZodCreateQuotationSchema = {
  companyDetails: defaultCompanyDetails,
  clientDetails: defaultClientDetails,
  quotationDetails: {
    theme: defaultTheme,
    currency: "MYR",
    prefix: "QUO-",
    serialNumber: "0001",
    date: new Date(),
    paymentTerms: "",
    billingDetails: [],
  },
  items: [],
  metadata: {
    notes: "",
    terms: "",
    paymentInformation: [],
  },
};
