import {
  createCreditNoteSchema,
  createCreditNoteSchemaDefaultValues,
  ZodCreateCreditNoteSchema,
} from "@/zod-schemas/credit-note/create-credit-note";
import { createCreditNotePdfBlob } from "@/lib/credit-note/create-credit-note-pdf-blob";
import { createBlobUrl, revokeBlobUrl } from "@/lib/invoice/create-blob-url";
import { creditNoteErrorAtom } from "@/global/atoms/credit-note-atom";
import { useContainerWidth } from "@/hooks/use-container-width";
import { useEffect, useRef, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Document, Page } from "react-pdf";
import { useSetAtom } from "jotai";
import { Loader2, AlertCircle } from "@/components/ui/icons";

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
  const effectiveWidth = width > 0 ? width : 600;
  const pageWidth = Math.min(effectiveWidth, 600) - PDF_VIEWER_PADDING;

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
            <AlertCircle className="size-6 text-destructive" />
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
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
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
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Generating preview...</p>
    </div>
  </div>
);

// Error component
const PDFError = ({ message }: { message: string }) => (
  <div className="flex h-full w-full items-center justify-center p-4">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <div>
        <p className="font-medium text-destructive">Failed to generate PDF</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
    </div>
  </div>
);

const CreditNotePreview = ({ form }: { form: UseFormReturn<ZodCreateCreditNoteSchema> }) => {
  const { ref: containerRef, width: containerWidth } = useContainerWidth<HTMLDivElement>();
  const setCreditNoteError = useSetAtom(creditNoteErrorAtom);
  const [data, setData] = useState(form.getValues());
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const lastProcessedValueRef = useRef<ZodCreateCreditNoteSchema>(createCreditNoteSchemaDefaultValues);

  // Watch for form changes, debounce input, validate, and then update data/errors
  useEffect(() => {
    const processFormValue = (value: ZodCreateCreditNoteSchema) => {
      if (isEqual(value, lastProcessedValueRef.current)) return; // skip unnecessary updates
      lastProcessedValueRef.current = cloneDeep(value);

      // First verify the data if it matches the schema
      const isDataValid = createCreditNoteSchema.safeParse(value);
      // If the data is valid, set the data to credit note and clear the errors
      if (isDataValid.success) {
        setData(value);
        setCreditNoteError([]);
      } else {
        setCreditNoteError(isDataValid.error.issues);
      }
    };

    // Create a debounced version of the processing function
    const debouncedProcessFormValue = debounce(processFormValue, 1000);

    const subscription = form.watch((value) => {
      // Ensure the watched value is cast correctly, matching the original logic
      debouncedProcessFormValue(value as ZodCreateCreditNoteSchema);
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

    (async () => {
      try {
        const blob = await createCreditNotePdfBlob({ creditNoteData: data, template: form.watch("creditNoteDetails.theme.template") });
        const newUrl = createBlobUrl({ blob });

        setGeneratedPdfUrl(newUrl);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setPdfError(errorMessage);
        console.error("[ERROR]: Failed to generate PDF:", err);
        if (generatedPdfUrl) {
          revokeBlobUrl({ url: generatedPdfUrl });
        }
      }
    })();

    // Cleanup on component unmount or when data changes again (before new generation)
    return () => {
      if (generatedPdfUrl) {
        revokeBlobUrl({ url: generatedPdfUrl });
      }
    };

    // Dont Include generatedPdfUrl in the dependency array as it will cause infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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

export default CreditNotePreview;
