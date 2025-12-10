import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { createCreditNotePdfBlob } from "@/lib/credit-note/create-credit-note-pdf-blob";
import { generateCreditNoteName } from "@/lib/credit-note/generate-credit-note-name";
import { createBlobUrl, revokeBlobUrl } from "@/lib/invoice/create-blob-url";
import { createPdfToImage } from "@/lib/invoice/create-pdf-to-image";
import { downloadFile } from "@/lib/invoice/download-file";
import { ERROR_MESSAGES } from "@/constants/issues";
import { toast } from "sonner";

export class CreditNoteDownloadManager {
  private creditNoteData: ZodCreateCreditNoteSchema | undefined;
  private creditNoteName: string | undefined;
  private blob: Blob | undefined;

  // Initialize the credit note data
  public async initialize(creditNote: ZodCreateCreditNoteSchema): Promise<void> {
    // Cleanup resources
    this.cleanup();

    // Initialize the credit note data
    this.creditNoteData = creditNote;
    this.creditNoteName = generateCreditNoteName({ creditNoteData: creditNote, extension: "pdf" });

    const creditNoteData = this.isCreditNoteDataInitialized();
    this.blob = await createCreditNotePdfBlob({ creditNoteData, template: creditNoteData.creditNoteDetails.theme.template });
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
    const fileName = generateCreditNoteName({ creditNoteData: this.isCreditNoteDataInitialized(), extension: "png" });
    downloadFile({ url, fileName });
    revokeBlobUrl({ url });
  }

  // Download the PDF
  public async downloadPdf() {
    const url = createBlobUrl({ blob: this.isBlobInitialized() });
    downloadFile({ url, fileName: this.isCreditNoteNameInitialized() });
    revokeBlobUrl({ url });
  }

  // Cleanup resources
  public cleanup(): void {
    // Reset class properties
    this.creditNoteData = undefined;
    this.creditNoteName = undefined;
    this.blob = undefined;
  }

  //   Error Handling
  private isBlobInitialized(): Blob {
    if (!this.blob) {
      toast.error(ERROR_MESSAGES.CREDIT_NOTE_BLOB_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.CREDIT_NOTE_BLOB_NOT_INITIALIZED);
    }
    return this.blob;
  }

  private isCreditNoteDataInitialized(): ZodCreateCreditNoteSchema {
    if (!this.creditNoteData) {
      toast.error(ERROR_MESSAGES.CREDIT_NOTE_DATA_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.CREDIT_NOTE_DATA_NOT_INITIALIZED);
    }
    return this.creditNoteData;
  }

  private isCreditNoteNameInitialized(): string {
    if (!this.creditNoteName) {
      toast.error(ERROR_MESSAGES.CREDIT_NOTE_NAME_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.CREDIT_NOTE_NAME_NOT_INITIALIZED);
    }
    return this.creditNoteName;
  }
}

export const CreditNoteDownloadManagerInstance = new CreditNoteDownloadManager();
