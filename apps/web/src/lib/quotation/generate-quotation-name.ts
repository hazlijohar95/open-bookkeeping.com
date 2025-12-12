import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";

interface GenerateQuotationNameProps {
  quotationData: ZodCreateQuotationSchema;
  extension: "pdf" | "png";
}

export const generateQuotationName = ({ quotationData, extension }: GenerateQuotationNameProps) => {
  return `Quotation-${quotationData.quotationDetails.prefix}${quotationData.quotationDetails.serialNumber}.${extension}`;
};
