import StatementDefaultPDF, { type StatementPDFData } from "@/components/pdf/statement/default";
import { pdf } from "@react-pdf/renderer";

interface CreateStatementPdfBlobProps {
  statementData: StatementPDFData;
}

export const createStatementPdfBlob = async ({ statementData }: CreateStatementPdfBlobProps) => {
  const pdfDocument = <StatementDefaultPDF data={statementData} />;
  const blob = await pdf(pdfDocument).toBlob();
  return blob;
};

export const downloadStatementPdf = async (statementData: StatementPDFData) => {
  const blob = await createStatementPdfBlob({ statementData });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Statement-${statementData.entity.name.replace(/[^a-zA-Z0-9]/g, "_")}-${new Date().toISOString().split("T")[0]}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
