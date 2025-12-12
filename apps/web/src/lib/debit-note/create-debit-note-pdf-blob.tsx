import type { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { DebitNoteDefaultPDF } from "@/components/pdf/debit-note";
import { pdf } from "@react-pdf/renderer";

export type DebitNotePdfTemplateName = "default" | "cynco" | "classic" | undefined;

interface CreateDebitNotePdfBlobProps {
  template: DebitNotePdfTemplateName;
  debitNoteData: ZodCreateDebitNoteSchema;
}

export const createDebitNotePdfBlob = async ({ debitNoteData, template }: CreateDebitNotePdfBlobProps) => {
  const Template = getDebitNotePdfTemplate(template);

  const pdfDocument = <Template data={debitNoteData} />;
  const blob = await pdf(pdfDocument).toBlob();

  return blob;
};

const getDebitNotePdfTemplate = (template: CreateDebitNotePdfBlobProps["template"]) => {
  // For now, all templates use the default debit note template
  // Can be extended with more templates later
  switch (template) {
    case "cynco":
    case "classic":
    default:
      return DebitNoteDefaultPDF;
  }
};
