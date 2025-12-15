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
export const createDebitNoteItemSchema = documentItemSchema;
export const createDebitNoteFieldKeyStringValuesSchema = fieldKeyStringValuesSchema;
export const createDebitNoteFieldKeyNumberValuesSchema = fieldKeyNumberValuesSchema;

export const createDebitNoteSchema = z.object({
  customerId: z.uuid().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  debitNoteDetails: z.object({
    theme: documentThemeSchema,
    currency: z.string().min(1, { message: "Currency cannot be empty" }),
    prefix: z.string().default("DN-"),
    serialNumber: z.string().min(1, { message: "Serial number cannot be empty" }),
    date: z.date(),
    originalInvoiceNumber: z.string().optional(),
    billingDetails: z.array(fieldKeyNumberValuesSchema),
  }),
  items: z.array(documentItemSchema),
  metadata: documentMetadataSchema,
});

export type ZodCreateDebitNoteSchema = z.infer<typeof createDebitNoteSchema>;

export const createDebitNoteSchemaDefaultValues: ZodCreateDebitNoteSchema = {
  companyDetails: defaultCompanyDetails,
  clientDetails: defaultClientDetails,
  debitNoteDetails: {
    theme: defaultTheme,
    currency: "MYR",
    prefix: "DN-",
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
