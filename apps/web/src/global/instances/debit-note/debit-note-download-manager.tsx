import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { createDebitNotePdfBlob } from "@/lib/debit-note/create-debit-note-pdf-blob";
import { generateDebitNoteName } from "@/lib/debit-note/generate-debit-note-name";
import { createBlobUrl, revokeBlobUrl } from "@/lib/invoice/create-blob-url";
import { createPdfToImage } from "@/lib/invoice/create-pdf-to-image";
import { downloadFile } from "@/lib/invoice/download-file";
import { ERROR_MESSAGES } from "@/constants/issues";
import { toast } from "sonner";

export class DebitNoteDownloadManager {
  private debitNoteData: ZodCreateDebitNoteSchema | undefined;
  private debitNoteName: string | undefined;
  private blob: Blob | undefined;

  // Initialize the debit note data
  public async initialize(debitNote: ZodCreateDebitNoteSchema): Promise<void> {
    // Cleanup resources
    this.cleanup();

    // Initialize the debit note data
    this.debitNoteData = debitNote;
    this.debitNoteName = generateDebitNoteName({ debitNoteData: debitNote, extension: "pdf" });

    const debitNoteData = this.isDebitNoteDataInitialized();
    this.blob = await createDebitNotePdfBlob({ debitNoteData, template: debitNoteData.debitNoteDetails.theme.template });
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
    const fileName = generateDebitNoteName({ debitNoteData: this.isDebitNoteDataInitialized(), extension: "png" });
    downloadFile({ url, fileName });
    revokeBlobUrl({ url });
  }

  // Download the PDF
  public async downloadPdf() {
    const url = createBlobUrl({ blob: this.isBlobInitialized() });
    downloadFile({ url, fileName: this.isDebitNoteNameInitialized() });
    revokeBlobUrl({ url });
  }

  // Cleanup resources
  public cleanup(): void {
    // Reset class properties
    this.debitNoteData = undefined;
    this.debitNoteName = undefined;
    this.blob = undefined;
  }

  //   Error Handling
  private isBlobInitialized(): Blob {
    if (!this.blob) {
      toast.error(ERROR_MESSAGES.DEBIT_NOTE_BLOB_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.DEBIT_NOTE_BLOB_NOT_INITIALIZED);
    }
    return this.blob;
  }

  private isDebitNoteDataInitialized(): ZodCreateDebitNoteSchema {
    if (!this.debitNoteData) {
      toast.error(ERROR_MESSAGES.DEBIT_NOTE_DATA_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.DEBIT_NOTE_DATA_NOT_INITIALIZED);
    }
    return this.debitNoteData;
  }

  private isDebitNoteNameInitialized(): string {
    if (!this.debitNoteName) {
      toast.error(ERROR_MESSAGES.DEBIT_NOTE_NAME_NOT_INITIALIZED);
      throw new Error(ERROR_MESSAGES.DEBIT_NOTE_NAME_NOT_INITIALIZED);
    }
    return this.debitNoteName;
  }
}

export const DebitNoteDownloadManagerInstance = new DebitNoteDownloadManager();
