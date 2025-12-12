import type { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { format } from "date-fns";

interface GenerateDebitNoteNameProps {
  debitNoteData: ZodCreateDebitNoteSchema;
  extension: "pdf" | "png";
}

export const generateDebitNoteName = ({ debitNoteData, extension }: GenerateDebitNoteNameProps): string => {
  const prefix = debitNoteData.debitNoteDetails.prefix ?? "DN-";
  const serialNumber = debitNoteData.debitNoteDetails.serialNumber;
  const date = format(debitNoteData.debitNoteDetails.date, "yyyy-MM-dd");

  return `${prefix}${serialNumber}_${date}.${extension}`;
};
