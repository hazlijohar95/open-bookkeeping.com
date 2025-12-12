import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { createQuotationPdfBlob } from "@/lib/quotation/create-quotation-pdf-blob";
import { generateQuotationName } from "@/lib/quotation/generate-quotation-name";
import { createBlobUrl, revokeBlobUrl } from "@/lib/invoice/create-blob-url";
import { createPdfToImage } from "@/lib/invoice/create-pdf-to-image";
import { downloadFile } from "@/lib/invoice/download-file";
import { ERROR_MESSAGES } from "@/constants/issues";
import { toast } from "sonner";

export class QuotationDownloadManager {
  private quotationData: ZodCreateQuotationSchema | undefined;
  private quotationName: string | undefined;
  private blob: Blob | undefined;

  // Initialize the quotation data
  public async initialize(quotation: ZodCreateQuotationSchema): Promise<void> {
    // Cleanup resources
    this.cleanup();

    // Initialize the quotation data
    this.quotationData = quotation;
    this.quotationName = generateQuotationName({ quotationData: quotation, extension: "pdf" });

    const quotationData = this.isQuotationDataInitialized();
    this.blob = await createQuotationPdfBlob({ quotationData, template: quotationData.quotationDetails.theme.template });
  }

  // Preview the PDF - we dont save data on preview
  public async previewPdf() {
    const url = createBlobUrl({ blob: this.isBlobInitialized() });
    window.open(url, "_blank");
    revokeBlobUrl({ url });
  }

  // Download PNG
  public async downloadPng() {
    const blob = await createPdfToImage({ pdfBlob: this.isBlobInitialized(), scale: 2 });
    const url = createBlobUrl({ blob });
    // we need name with png extension
    const fileName = generateQuotationName({ quotationData: this.isQuotationDataInitialized(), extension: "png" });
    downloadFile({ url, fileName });
    revokeBlobUrl({ url });
  }

  // Download the PDF
  public async downloadPdf() {
    const url = createBlobUrl({ blob: this.isBlobInitialized() });
    downloadFile({ url, fileName: this.isQuotationNameInitialized() });
    revokeBlobUrl({ url });
  }

  // Cleanup resources
  public cleanup(): void {
    // Reset class properties
    this.quotationData = undefined;
    this.quotationName = undefined;
    this.blob = undefined;
  }

  //   Error Handling
  private isBlobInitialized(): Blob {
    if (!this.blob) {
      toast.error(ERROR_MESSAGES.QUOTATION_BLOB_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.QUOTATION_BLOB_NOT_INITIALIZED);
    }
    return this.blob;
  }

  private isQuotationDataInitialized(): ZodCreateQuotationSchema {
    if (!this.quotationData) {
      toast.error(ERROR_MESSAGES.QUOTATION_DATA_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.QUOTATION_DATA_NOT_INITIALIZED);
    }
    return this.quotationData;
  }

  private isQuotationNameInitialized(): string {
    if (!this.quotationName) {
      toast.error(ERROR_MESSAGES.QUOTATION_NAME_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.QUOTATION_NAME_NOT_INITIALIZED);
    }
    return this.quotationName;
  }
}

export const QuotationDownloadManagerInstance = new QuotationDownloadManager();
