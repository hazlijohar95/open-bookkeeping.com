import { z } from "zod";
import {
  valueTypeSchema,
  noteReasonSchema,
  fieldKeyStringValuesSchema,
  fieldKeyNumberValuesSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
  documentThemeSchema,
  documentMetadataSchema,
  defaultCompanyDetails,
  defaultClientDetails,
  defaultTheme,
} from "../common";

// Re-export shared schemas for backward compatibility
export const valueType = valueTypeSchema;
export const noteReason = noteReasonSchema;
export const createCreditNoteItemSchema = documentItemSchema;
export const createCreditNoteFieldKeyStringValuesSchema = fieldKeyStringValuesSchema;
export const createCreditNoteFieldKeyNumberValuesSchema = fieldKeyNumberValuesSchema;

export const createCreditNoteSchema = z.object({
  customerId: z.uuid().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  creditNoteDetails: z.object({
    theme: documentThemeSchema,
    currency: z.string().min(1, { message: "Currency cannot be empty" }),
    prefix: z.string().default("CN-"),
    serialNumber: z.string().min(1, { message: "Serial number cannot be empty" }),
    date: z.date(),
    originalInvoiceNumber: z.string().optional(),
    billingDetails: z.array(fieldKeyNumberValuesSchema),
  }),
  items: z.array(documentItemSchema),
  metadata: documentMetadataSchema,
});

export type ZodCreateCreditNoteSchema = z.infer<typeof createCreditNoteSchema>;

export const createCreditNoteSchemaDefaultValues: ZodCreateCreditNoteSchema = {
  companyDetails: defaultCompanyDetails,
  clientDetails: defaultClientDetails,
  creditNoteDetails: {
    theme: defaultTheme,
    currency: "MYR",
    prefix: "CN-",
    serialNumber: "0001",
    date: new Date(),
    billingDetails: [],
  },
  items: [],
  metadata: {
    notes: "",
    terms: "",
  },
};
