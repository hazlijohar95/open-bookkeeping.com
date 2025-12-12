import type { creditNoteTypeEnum, creditNoteStatusEnum } from "@open-bookkeeping/db";
import type { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";

export type CreditNoteTypeType = (typeof creditNoteTypeEnum.enumValues)[number];
export type CreditNoteStatusType = (typeof creditNoteStatusEnum.enumValues)[number];

export interface IDBCreditNote {
  id: string;
  type: CreditNoteTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: CreditNoteStatusType;
  creditNoteFields: ZodCreateCreditNoteSchema;
}
