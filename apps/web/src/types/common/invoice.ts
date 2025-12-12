import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";

// Invoice type values (local or server storage)
export const invoiceTypeValues = ["local", "server"] as const;
export type InvoiceTypeType = (typeof invoiceTypeValues)[number];

// Invoice status values
export const invoiceStatusValues = ["pending", "success", "error", "expired", "refunded"] as const;
export type InvoiceStatusType = (typeof invoiceStatusValues)[number];

// Mimic Drizzle's pgEnum structure for compatibility
export const invoiceStatusEnum = {
  enumValues: invoiceStatusValues,
} as const;

export interface Invoice {
  id: string;
  type: InvoiceTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: InvoiceStatusType;
  paidAt: Date | null;
  invoiceFields: ZodCreateInvoiceSchema;
}

// API response type where nested fields can be null
export interface InvoiceApiResponse {
  id: string;
  type: InvoiceTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: InvoiceStatusType;
  paidAt: Date | null;
  invoiceFields: {
    companyDetails: ZodCreateInvoiceSchema["companyDetails"] | null;
    clientDetails: ZodCreateInvoiceSchema["clientDetails"] | null;
    invoiceDetails: ZodCreateInvoiceSchema["invoiceDetails"] | null;
    items: ZodCreateInvoiceSchema["items"];
    metadata: ZodCreateInvoiceSchema["metadata"] | null;
  } | null;
}

// Helper to check if an invoice response has all required fields
export function isCompleteInvoice(invoice: InvoiceApiResponse): invoice is Invoice {
  return !!(
    invoice.invoiceFields &&
    invoice.invoiceFields.companyDetails &&
    invoice.invoiceFields.clientDetails &&
    invoice.invoiceFields.invoiceDetails &&
    invoice.invoiceFields.metadata
  );
}

// Helper to filter and transform API responses to Invoice[]
export function toInvoices(apiInvoices: InvoiceApiResponse[] | undefined): Invoice[] {
  if (!apiInvoices) return [];
  return apiInvoices.filter(isCompleteInvoice);
}

export type InvoiceImageType = "logo" | "signature";
