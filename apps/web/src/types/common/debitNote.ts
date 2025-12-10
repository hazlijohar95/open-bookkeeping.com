import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";

// Debit note type values (local or server storage)
export const debitNoteTypeValues = ["local", "server"] as const;
export type DebitNoteTypeType = (typeof debitNoteTypeValues)[number];

// Debit note status values
export const debitNoteStatusValues = ["draft", "issued", "applied", "cancelled"] as const;
export type DebitNoteStatusType = (typeof debitNoteStatusValues)[number];

// Reason values (same as credit note)
export const noteReasonValues = ["return", "discount", "pricing_error", "damaged_goods", "other"] as const;
export type NoteReasonType = (typeof noteReasonValues)[number];

// Mimic Drizzle's pgEnum structure for compatibility
export const debitNoteStatusEnum = {
  enumValues: debitNoteStatusValues,
} as const;

// Human-readable reason labels
export const noteReasonLabels: Record<NoteReasonType, string> = {
  return: "Return",
  discount: "Discount",
  pricing_error: "Pricing Error",
  damaged_goods: "Damaged Goods",
  other: "Other",
};

export interface DebitNote {
  id: string;
  type: DebitNoteTypeType;
  status: DebitNoteStatusType;
  reason: NoteReasonType;
  reasonDescription: string | null;
  invoiceId: string | null;
  customerId: string | null;
  vendorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  issuedAt: Date | null;
  debitNoteFields: ZodCreateDebitNoteSchema;
}

// API response type where nested fields can be null
export interface DebitNoteApiResponse {
  id: string;
  type: DebitNoteTypeType;
  status: DebitNoteStatusType;
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
  debitNoteFields: {
    companyDetails: ZodCreateDebitNoteSchema["companyDetails"] | null;
    clientDetails: ZodCreateDebitNoteSchema["clientDetails"] | null;
    debitNoteDetails: ZodCreateDebitNoteSchema["debitNoteDetails"] | null;
    items: ZodCreateDebitNoteSchema["items"];
    metadata: ZodCreateDebitNoteSchema["metadata"] | null;
  } | null;
}

// Helper to check if a debit note response has all required fields
export function isCompleteDebitNote(debitNote: DebitNoteApiResponse): boolean {
  return !!(
    debitNote.debitNoteFields &&
    debitNote.debitNoteFields.companyDetails &&
    debitNote.debitNoteFields.clientDetails &&
    debitNote.debitNoteFields.debitNoteDetails
  );
}

// Helper to filter and transform API responses to DebitNote[]
export function toDebitNotes(apiDebitNotes: DebitNoteApiResponse[] | undefined): DebitNoteApiResponse[] {
  if (!apiDebitNotes) return [];
  return apiDebitNotes.filter(isCompleteDebitNote);
}
