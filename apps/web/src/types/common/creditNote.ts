import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";

// Credit note type values (local or server storage)
export const creditNoteTypeValues = ["local", "server"] as const;
export type CreditNoteTypeType = (typeof creditNoteTypeValues)[number];

// Credit note status values
export const creditNoteStatusValues = ["draft", "issued", "applied", "cancelled"] as const;
export type CreditNoteStatusType = (typeof creditNoteStatusValues)[number];

// Reason values
export const noteReasonValues = ["return", "discount", "pricing_error", "damaged_goods", "other"] as const;
export type NoteReasonType = (typeof noteReasonValues)[number];

// Mimic Drizzle's pgEnum structure for compatibility
export const creditNoteStatusEnum = {
  enumValues: creditNoteStatusValues,
} as const;

export const noteReasonEnum = {
  enumValues: noteReasonValues,
} as const;

// Human-readable reason labels
export const noteReasonLabels: Record<NoteReasonType, string> = {
  return: "Return",
  discount: "Discount",
  pricing_error: "Pricing Error",
  damaged_goods: "Damaged Goods",
  other: "Other",
};

export interface CreditNote {
  id: string;
  type: CreditNoteTypeType;
  status: CreditNoteStatusType;
  reason: NoteReasonType;
  reasonDescription: string | null;
  invoiceId: string | null;
  customerId: string | null;
  vendorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  issuedAt: Date | null;
  creditNoteFields: ZodCreateCreditNoteSchema;
}

// API response type where nested fields can be null
export interface CreditNoteApiResponse {
  id: string;
  type: CreditNoteTypeType;
  status: CreditNoteStatusType;
  reason: NoteReasonType;
  reasonDescription: string | null;
  invoiceId: string | null;
  customerId: string | null;
  vendorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  issuedAt: Date | null;
  invoice: { id: string } | null;
  customer: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
  creditNoteFields: {
    companyDetails: ZodCreateCreditNoteSchema["companyDetails"] | null;
    clientDetails: ZodCreateCreditNoteSchema["clientDetails"] | null;
    creditNoteDetails: ZodCreateCreditNoteSchema["creditNoteDetails"] | null;
    items: ZodCreateCreditNoteSchema["items"];
    metadata: ZodCreateCreditNoteSchema["metadata"] | null;
  } | null;
}

// Helper to check if a credit note response has all required fields
export function isCompleteCreditNote(creditNote: CreditNoteApiResponse): boolean {
  return !!(
    creditNote.creditNoteFields &&
    creditNote.creditNoteFields.companyDetails &&
    creditNote.creditNoteFields.clientDetails &&
    creditNote.creditNoteFields.creditNoteDetails
  );
}

// Helper to filter and transform API responses to CreditNote[]
export function toCreditNotes(apiCreditNotes: CreditNoteApiResponse[] | undefined): CreditNoteApiResponse[] {
  if (!apiCreditNotes) return [];
  return apiCreditNotes.filter(isCompleteCreditNote);
}
