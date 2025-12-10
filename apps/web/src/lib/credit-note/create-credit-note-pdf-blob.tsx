import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { CreditNoteDefaultPDF } from "@/components/pdf/credit-note";
import { pdf } from "@react-pdf/renderer";

export type CreditNotePdfTemplateName = "default" | "cynco" | "classic" | undefined;

interface CreateCreditNotePdfBlobProps {
  template: CreditNotePdfTemplateName;
  creditNoteData: ZodCreateCreditNoteSchema;
}

export const createCreditNotePdfBlob = async ({ creditNoteData, template }: CreateCreditNotePdfBlobProps) => {
  const Template = getCreditNotePdfTemplate(template);

  const pdfDocument = <Template data={creditNoteData} />;
  const blob = await pdf(pdfDocument).toBlob();

  return blob;
};

const getCreditNotePdfTemplate = (template: CreateCreditNotePdfBlobProps["template"]) => {
  // For now, all templates use the default credit note template
  // Can be extended with more templates later
  switch (template) {
    case "cynco":
    case "classic":
    default:
      return CreditNoteDefaultPDF;
  }
};
