import { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";

// Quotation type values (local or server storage)
export const quotationTypeValues = ["local", "server"] as const;
export type QuotationTypeType = (typeof quotationTypeValues)[number];

// Quotation status values
export const quotationStatusValues = ["draft", "sent", "accepted", "rejected", "expired", "converted"] as const;
export type QuotationStatusType = (typeof quotationStatusValues)[number];

// Mimic Drizzle's pgEnum structure for compatibility
export const quotationStatusEnum = {
  enumValues: quotationStatusValues,
} as const;

export interface Quotation {
  id: string;
  type: QuotationTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: QuotationStatusType;
  validUntil: string | null;
  acceptedAt: Date | null;
  convertedInvoiceId: string | null;
  quotationFields: ZodCreateQuotationSchema;
}

// API response type where nested fields can be null
export interface QuotationApiResponse {
  id: string;
  type: QuotationTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: QuotationStatusType;
  validUntil: string | null;
  acceptedAt: Date | null;
  convertedInvoiceId: string | null;
  quotationFields: {
    companyDetails: ZodCreateQuotationSchema["companyDetails"] | null;
    clientDetails: ZodCreateQuotationSchema["clientDetails"] | null;
    quotationDetails: ZodCreateQuotationSchema["quotationDetails"] | null;
    items: ZodCreateQuotationSchema["items"];
    metadata: ZodCreateQuotationSchema["metadata"] | null;
  } | null;
}

// Helper to check if a quotation response has all required fields
export function isCompleteQuotation(quotation: QuotationApiResponse): quotation is Quotation {
  return !!(
    quotation.quotationFields &&
    quotation.quotationFields.companyDetails &&
    quotation.quotationFields.clientDetails &&
    quotation.quotationFields.quotationDetails &&
    quotation.quotationFields.metadata
  );
}

// Helper to filter and transform API responses to Quotation[]
export function toQuotations(apiQuotations: QuotationApiResponse[] | undefined): Quotation[] {
  if (!apiQuotations) return [];
  return apiQuotations.filter(isCompleteQuotation);
}
