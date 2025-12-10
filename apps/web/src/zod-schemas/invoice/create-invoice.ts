import { z } from "zod";
import {
  valueTypeSchema,
  fieldKeyStringValuesSchema,
  fieldKeyNumberValuesSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
  themeSchema,
  documentMetadataWithPaymentInfoSchema,
  defaultCompanyDetails,
  defaultClientDetails,
  defaultTheme,
} from "../common";

// Re-export shared schemas for backward compatibility
export const valueType = valueTypeSchema;
export const createInvoiceItemSchema = documentItemSchema;
export const createInvoiceFieldKeyStringValuesSchema = fieldKeyStringValuesSchema;
export const createInvoiceFieldKeyNumberValuesSchema = fieldKeyNumberValuesSchema;

// Invoice-specific company details (requires min 10 char address)
const invoiceCompanyDetailsSchema = companyDetailsSchema.extend({
  address: z.string().min(10, {
    message: "Company address must be at least 10 characters",
  }),
});

// Invoice-specific client details (requires min 10 char address)
const invoiceClientDetailsSchema = clientDetailsSchema.extend({
  address: z.string().min(10, {
    message: "Client address must be at least 10 characters",
  }),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
  companyDetails: invoiceCompanyDetailsSchema,
  clientDetails: invoiceClientDetailsSchema,
  invoiceDetails: z.object({
    theme: themeSchema,
    currency: z.string().min(1, { message: "Currency cannot be empty" }),
    prefix: z.string(),
    serialNumber: z.string().min(1, { message: "Serial number cannot be empty" }),
    poNumber: z.string().optional(),
    referenceNumber: z.string().optional(),
    date: z.date(),
    dueDate: z.date().optional().nullable(),
    paymentTerms: z.string(),
    billingDetails: z.array(fieldKeyNumberValuesSchema),
  }),
  items: z.array(documentItemSchema).min(1, { message: "At least one item is required" }),
  metadata: documentMetadataWithPaymentInfoSchema,
});

export type ZodCreateInvoiceSchema = z.infer<typeof createInvoiceSchema>;

export const createInvoiceSchemaDefaultValues: ZodCreateInvoiceSchema = {
  companyDetails: defaultCompanyDetails,
  clientDetails: defaultClientDetails,
  invoiceDetails: {
    theme: defaultTheme,
    currency: "MYR",
    prefix: "INV-",
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
