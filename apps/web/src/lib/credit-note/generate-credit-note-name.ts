import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { format } from "date-fns";

interface GenerateCreditNoteNameProps {
  creditNoteData: ZodCreateCreditNoteSchema;
  extension: "pdf" | "png";
}

export const generateCreditNoteName = ({ creditNoteData, extension }: GenerateCreditNoteNameProps): string => {
  const prefix = creditNoteData.creditNoteDetails.prefix || "CN-";
  const serialNumber = creditNoteData.creditNoteDetails.serialNumber;
  const date = format(creditNoteData.creditNoteDetails.date, "yyyy-MM-dd");

  return `${prefix}${serialNumber}_${date}.${extension}`;
};
