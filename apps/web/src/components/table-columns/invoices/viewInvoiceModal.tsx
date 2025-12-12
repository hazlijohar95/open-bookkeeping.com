import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogHeaderContainer,
  DialogContentContainer,
  DialogIcon,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  EyeScannerIcon,
  FileDownloadIcon,
  ImageSparkleIcon,
  VersionsIcon,
} from "@/assets/icons";
import { createBlobUrl, revokeBlobUrl } from "@/lib/invoice/create-blob-url";
import { generateInvoiceName } from "@/lib/invoice/generate-invoice-name";
import { createPdfToImage } from "@/lib/invoice/create-pdf-to-image";
import { createPdfBlob } from "@/lib/invoice/create-pdf-blob";
import { downloadFile } from "@/lib/invoice/download-file";
import type { Invoice } from "@/types/common/invoice";
import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { toast } from "sonner";

interface ViewInvoiceModalProps {
  invoice: Invoice;
  // Controlled mode props (optional)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Normalize invoice data to ensure all required fields exist for PDF generation
function normalizeInvoiceData(data: ZodCreateInvoiceSchema): ZodCreateInvoiceSchema {
  return {
    ...data,
    companyDetails: {
      ...data.companyDetails,
      name: data.companyDetails?.name ?? "",
      address: data.companyDetails?.address ?? "",
      metadata: data.companyDetails?.metadata ?? [],
    },
    clientDetails: {
      ...data.clientDetails,
      name: data.clientDetails?.name ?? "",
      address: data.clientDetails?.address ?? "",
      metadata: data.clientDetails?.metadata ?? [],
    },
    invoiceDetails: {
      ...data.invoiceDetails,
      theme: {
        baseColor: data.invoiceDetails?.theme?.baseColor ?? "#2563EB",
        mode: data.invoiceDetails?.theme?.mode ?? "light",
        template: data.invoiceDetails?.theme?.template ?? "default",
      },
      currency: data.invoiceDetails?.currency ?? "MYR",
      prefix: data.invoiceDetails?.prefix ?? "INV-",
      serialNumber: data.invoiceDetails?.serialNumber ?? "0001",
      date: data.invoiceDetails?.date ?? new Date(),
      dueDate: data.invoiceDetails?.dueDate ?? null,
      paymentTerms: data.invoiceDetails?.paymentTerms ?? "",
      billingDetails: data.invoiceDetails?.billingDetails ?? [],
    },
    items: data.items ?? [],
    metadata: {
      notes: data.metadata?.notes ?? "",
      terms: data.metadata?.terms ?? "",
      paymentInformation: data.metadata?.paymentInformation ?? [],
    },
  };
}

export default function ViewInvoiceModal({ invoice, open, onOpenChange }: ViewInvoiceModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Support both controlled and uncontrolled modes
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const invoiceData = normalizeInvoiceData(invoice.invoiceFields);
  const serialNumber = `${invoiceData.invoiceDetails.prefix}${invoiceData.invoiceDetails.serialNumber}`;
  const template = invoiceData.invoiceDetails.theme?.template ?? "default";

  const handleViewPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoadingAction("view");
    try {
      const blob = await createPdfBlob({ invoiceData, template });
      const url = createBlobUrl({ blob });
      window.open(url, "_blank");
      setTimeout(() => revokeBlobUrl({ url }), 1000);
    } catch (error) {
      toast.error("Failed to generate PDF");
      console.error("[ViewInvoiceModal] View PDF error:", error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoadingAction("download-pdf");
    try {
      const blob = await createPdfBlob({ invoiceData, template });
      const url = createBlobUrl({ blob });
      const fileName = generateInvoiceName({ invoiceData, extension: "pdf" });
      downloadFile({ url, fileName });
      setTimeout(() => revokeBlobUrl({ url }), 100);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PDF");
      console.error("[ViewInvoiceModal] Download PDF error:", error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadPng = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoadingAction("download-png");
    try {
      const pdfBlob = await createPdfBlob({ invoiceData, template });
      const blob = await createPdfToImage({ pdfBlob, scale: 2 });
      const url = createBlobUrl({ blob });
      const fileName = generateInvoiceName({ invoiceData, extension: "png" });
      downloadFile({ url, fileName });
      setTimeout(() => revokeBlobUrl({ url }), 100);
      toast.success("PNG downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PNG");
      console.error("[ViewInvoiceModal] Download PNG error:", error);
    } finally {
      setLoadingAction(null);
    }
  };

  const isLoading = loadingAction !== null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Only show trigger in uncontrolled mode */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="secondary" size="xs">
            View
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeaderContainer>
          <DialogIcon>
            <VersionsIcon className="size-5" />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Invoice {serialNumber}</DialogTitle>
            <DialogDescription>View or download this invoice</DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-3 h-10"
              onClick={handleViewPdf}
              disabled={isLoading}
            >
              {loadingAction === "view" ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <EyeScannerIcon className="size-4" />
              )}
              <span>View PDF</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-3 h-10"
              onClick={handleDownloadPdf}
              disabled={isLoading}
            >
              {loadingAction === "download-pdf" ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <FileDownloadIcon className="size-4" />
              )}
              <span>Download PDF</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-3 h-10"
              onClick={handleDownloadPng}
              disabled={isLoading}
            >
              {loadingAction === "download-png" ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <ImageSparkleIcon className="size-4" />
              )}
              <span>Download PNG</span>
            </Button>
          </div>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
