import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { QuotationDefaultPDF } from "@/components/pdf/quotation";
import { pdf } from "@react-pdf/renderer";

export type QuotationPdfTemplateName = "default" | "cynco" | "classic" | undefined;

interface CreateQuotationPdfBlobProps {
  template: QuotationPdfTemplateName;
  quotationData: ZodCreateQuotationSchema;
}

export const createQuotationPdfBlob = async ({ quotationData, template }: CreateQuotationPdfBlobProps) => {
  const Template = getQuotationPdfTemplate(template);

  const pdfDocument = <Template data={quotationData} />;
  const blob = await pdf(pdfDocument).toBlob();

  return blob;
};

const getQuotationPdfTemplate = (template: CreateQuotationPdfBlobProps["template"]) => {
  // For now, all templates use the default quotation template
  // Can be extended with more templates later
  switch (template) {
    case "cynco":
    case "classic":
    default:
      return QuotationDefaultPDF;
  }
};
