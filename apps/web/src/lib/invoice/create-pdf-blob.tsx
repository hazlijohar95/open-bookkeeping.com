import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { DefaultPDF, CyncoPDF, ClassicPDF, ZenPDF, ExecutivePDF } from "@/components/pdf";
import { pdf } from "@react-pdf/renderer";

export type PdfTemplateName = "default" | "cynco" | "classic" | "zen" | "executive" | undefined;

interface CreatePdfBlobProps {
  template: PdfTemplateName;
  invoiceData: ZodCreateInvoiceSchema;
}

export const createPdfBlob = async ({ invoiceData, template }: CreatePdfBlobProps) => {
  const Template = getPdfTemplate(template);

  const pdfDocument = <Template data={invoiceData} />;
  const blob = await pdf(pdfDocument).toBlob();

  return blob;
};

const getPdfTemplate = (template: CreatePdfBlobProps["template"]) => {
  // if there is no template, fallback to default
  if (!template) {
    return DefaultPDF;
  }

  // else return the specified template
  switch (template) {
    case "cynco":
      return CyncoPDF;
    case "classic":
      return ClassicPDF;
    case "zen":
      return ZenPDF;
    case "executive":
      return ExecutivePDF;
    default:
      return DefaultPDF;
  }
};
