import { debitNoteTypeEnum, debitNoteStatusEnum } from "@open-bookkeeping/db";
import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";

export type DebitNoteTypeType = (typeof debitNoteTypeEnum.enumValues)[number];
export type DebitNoteStatusType = (typeof debitNoteStatusEnum.enumValues)[number];

export interface IDBDebitNote {
  id: string;
  type: DebitNoteTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: DebitNoteStatusType;
  debitNoteFields: ZodCreateDebitNoteSchema;
}
