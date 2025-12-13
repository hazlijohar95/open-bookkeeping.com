import type {
  ZodCreateInvoiceSchema} from "@/zod-schemas/invoice/create-invoice";
import {
  createInvoiceSchema,
  createInvoiceSchemaDefaultValues
} from "@/zod-schemas/invoice/create-invoice";
import { createBlobUrl, revokeBlobUrl } from "@/lib/invoice/create-blob-url";
import { invoiceErrorAtom } from "@/global/atoms/invoice-atom";
import { createPdfBlob } from "@/lib/invoice/create-pdf-blob";
import { useContainerWidth } from "@/hooks/use-container-width";
import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Document, Page } from "react-pdf";
import { useSetAtom } from "jotai";
import { Loader2Icon, AlertCircleIcon } from "@/components/ui/icons";

// Native replacement for lodash isEqual - deep comparison via JSON
const isEqual = (a: unknown, b: unknown): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
};

// Native replacement for lodash cloneDeep - structuredClone for modern browsers
const cloneDeep = <T,>(obj: T): T => {
  return structuredClone(obj);
};

// Native replacement for lodash debounce
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  return debouncedFn as T & { cancel: () => void };
}

const PDF_VIEWER_PADDING = 18;

// Custom PDF viewer component that handles displaying a PDF document
const PDFViewer = ({ url, width }: { url: string | null; width: number }) => {
  const [error, setError] = useState<Error | null>(null);
  const [, setIsLoading] = useState(true);

  // Calculate effective width - use 600px as fallback if container not measured yet
  // Removed 600px cap to allow PDF to scale to container width
  const effectiveWidth = width > 0 ? width : 600;
  const pageWidth = effectiveWidth - PDF_VIEWER_PADDING;

  // Show empty state if the url is not loaded
  if (!url) {
    return null;
  }

  // Show error state if PDF failed to load
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircleIcon className="size-6 text-destructive" />
          </div>
          <div>
            <p className="font-medium text-destructive">Failed to load PDF</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Document
        file={url}
        loading={
          <div className="flex h-full w-full items-center justify-center">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
        onLoadSuccess={() => setIsLoading(false)}
        onLoadError={(error) => {
          console.error("[ERROR]: Error loading PDF:", error);
          setError(error);
          setIsLoading(false);
        }}
        className="scroll-bar-hidden dark:bg-background flex h-full max-h-full w-full items-center justify-center overflow-y-scroll py-[18px] sm:items-start"
      >
        <Page
          pageNumber={1}
          width={pageWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={
            <div className="flex items-center justify-center" style={{ width: pageWidth, height: pageWidth * 1.414 }}>
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        />
      </Document>
    </div>
  );
};

// Loading component
const PDFLoading = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Generating preview...</p>
    </div>
  </div>
);

// Error component
const PDFError = ({ message }: { message: string }) => (
  <div className="flex h-full w-full items-center justify-center p-4">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircleIcon className="size-6 text-destructive" />
      </div>
      <div>
        <p className="font-medium text-destructive">Failed to generate PDF</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
    </div>
  </div>
);

const InvoicePreview = ({ form }: { form: UseFormReturn<ZodCreateInvoiceSchema> }) => {
  const { ref: containerRef, width: containerWidth } = useContainerWidth();
  const setInvoiceError = useSetAtom(invoiceErrorAtom);
  const [data, setData] = useState(form.getValues());
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const lastProcessedValueRef = useRef<ZodCreateInvoiceSchema>(createInvoiceSchemaDefaultValues);
  // Use ref to track current URL for proper cleanup (avoids stale closure issues)
  const currentUrlRef = useRef<string | null>(null);

  // Watch for form changes, debounce input, validate, and then update data/errors
  useEffect(() => {
    const processFormValue = (value: ZodCreateInvoiceSchema) => {
      if (isEqual(value, lastProcessedValueRef.current)) return; // skip unnecessary updates
      lastProcessedValueRef.current = cloneDeep(value);

      // First verify the data if it matches the schema
      const isDataValid = createInvoiceSchema.safeParse(value);
      // Always update data for preview (even if validation fails)
      // This allows the preview to work while building the invoice
      setData(value);

      // Set or clear validation errors for user feedback
      if (isDataValid.success) {
        setInvoiceError([]);
      } else {
        setInvoiceError(isDataValid.error.issues);
      }
    };

    // Create a debounced version of the processing function
    // 300ms provides responsive feedback while avoiding excessive PDF regeneration
    const debouncedProcessFormValue = debounce(processFormValue, 300);

    const subscription = form.watch((value) => {
      // Ensure the watched value is cast correctly, matching the original logic
      debouncedProcessFormValue(value as ZodCreateInvoiceSchema);
    });

    return () => {
      // Cleanup subscription and cancel any pending debounced calls
      subscription.unsubscribe();
      debouncedProcessFormValue.cancel();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Effect to generate PDF when data changes
  useEffect(() => {
    setPdfError(null);

    void (async () => {
      let newUrl: string | null = null;
      try {
        const blob = await createPdfBlob({ invoiceData: data, template: form.watch("invoiceDetails.theme.template") });
        newUrl = createBlobUrl({ blob });

        // Revoke previous URL before setting new one
        if (currentUrlRef.current) {
          revokeBlobUrl({ url: currentUrlRef.current });
        }
        currentUrlRef.current = newUrl;
        setGeneratedPdfUrl(newUrl);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setPdfError(errorMessage);
        console.error("[ERROR]: Failed to generate PDF:", err);
        // Clean up the new URL if it was created before the error
        if (newUrl) {
          revokeBlobUrl({ url: newUrl });
        }
      }
    })();

    // Cleanup on component unmount
    return () => {
      if (currentUrlRef.current) {
        revokeBlobUrl({ url: currentUrlRef.current });
        currentUrlRef.current = null;
      }
    };
  }, [data, form]);

  // If there is an error loading the PDF, show an error message
  if (pdfError) {
    return (
      <div className="h-full w-full">
        <PDFError message={pdfError} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="scroll-bar-hidden bg-sidebar h-full w-full overflow-y-auto">
      {!generatedPdfUrl ? (
        <div className="h-full w-full">
          <PDFLoading />
        </div>
      ) : (
        <PDFViewer url={generatedPdfUrl} width={containerWidth} />
      )}
    </div>
  );
};

export default InvoicePreview;
