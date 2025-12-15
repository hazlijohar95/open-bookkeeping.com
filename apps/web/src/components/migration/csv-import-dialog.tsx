/**
 * Generic CSV Import Dialog
 * Reusable component for importing data from CSV files
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  parseCSVFile,
  mapCSVData,
  type ColumnMapping,
  type ParseResult,
  type ParseError,
} from "@/lib/csv-parser";
import {
  Upload,
  FileTextIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  Download,
  Trash2Icon,
  Loader2Icon,
} from "@/components/ui/icons";

interface CSVImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  mappings: ColumnMapping[];
  templateContent: string;
  templateFilename: string;
  onImport: (data: T[]) => Promise<void>;
  renderPreview?: (data: T[]) => React.ReactNode;
}

type ImportStep = "upload" | "preview" | "importing" | "complete";

export function CSVImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  mappings,
  templateContent,
  templateFilename,
  onImport,
  renderPreview,
}: CSVImportDialogProps<T>) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [parseResult, setParseResult] = useState<ParseResult<T> | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setParseResult(null);
    setFileName("");
    setImportError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setImportError("Please upload a CSV file");
        return;
      }

      try {
        setFileName(file.name);
        setImportError(null);

        const rawResult = await parseCSVFile(file);

        if (rawResult.errors.length > 0) {
          setImportError(`CSV parsing error: ${rawResult.errors[0]?.message ?? "Unknown error"}`);
          return;
        }

        const mapped = mapCSVData<T>(rawResult.data, mappings);
        setParseResult(mapped);
        setStep("preview");
      } catch {
        setImportError("Failed to parse CSV file");
      }
    },
    [mappings]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([templateContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = templateFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [templateContent, templateFilename]);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;

    setStep("importing");
    setImportError(null);

    try {
      await onImport(parseResult.data);
      setStep("complete");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
      setStep("preview");
    }
  }, [parseResult, onImport]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <Upload className="size-10 text-muted-foreground mb-4" />
                <p className="text-sm font-medium">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .csv files only
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {importError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircleIcon className="size-4 shrink-0" />
                  {importError}
                </div>
              )}

              {/* Template download */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">Need a template?</p>
                  <p className="text-xs text-muted-foreground">
                    Download our CSV template to get started
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="size-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </motion.div>
          )}

          {step === "preview" && parseResult && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* File info */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <FileTextIcon className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {parseResult.meta.totalRows} rows found
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  <Trash2Icon className="size-4" />
                </Button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="size-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {parseResult.meta.validRows} Valid
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border bg-rose-50 dark:bg-rose-950/20 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircleIcon className="size-4 text-rose-600" />
                    <span className="text-sm font-medium text-rose-700 dark:text-rose-400">
                      {parseResult.meta.invalidRows} Invalid
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {parseResult.meta.totalRows} Total
                    </span>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Validation Errors</p>
                  <ScrollArea className="h-32 rounded-lg border">
                    <div className="p-3 space-y-2">
                      {parseResult.errors.slice(0, 10).map((error, idx) => (
                        <ErrorRow key={idx} error={error} />
                      ))}
                      {parseResult.errors.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          ... and {parseResult.errors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Preview */}
              {renderPreview && parseResult.data.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Preview</p>
                  <ScrollArea className="h-48 rounded-lg border">
                    <div className="p-3">{renderPreview(parseResult.data.slice(0, 5))}</div>
                  </ScrollArea>
                </div>
              )}

              {importError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircleIcon className="size-4 shrink-0" />
                  {importError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={parseResult.meta.validRows === 0}
                >
                  Import {parseResult.meta.validRows} Rows
                </Button>
              </div>
            </motion.div>
          )}

          {step === "importing" && (
            <motion.div
              key="importing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <Loader2Icon className="size-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-medium">Importing data...</p>
              <p className="text-xs text-muted-foreground">This may take a moment</p>
            </motion.div>
          )}

          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30 mb-4">
                <CheckCircleIcon className="size-8 text-emerald-600" />
              </div>
              <p className="text-lg font-medium">Import Complete</p>
              <p className="text-sm text-muted-foreground mb-6">
                Successfully imported {parseResult?.meta.validRows ?? 0} rows
              </p>
              <Button onClick={handleClose}>Done</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function ErrorRow({ error }: { error: ParseError }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">Row {error.row}:</span>
      <span className="text-destructive">
        {error.field && <span className="font-medium">{error.field}</span>} {error.message}
        {error.value && <span className="text-muted-foreground"> (got: "{error.value}")</span>}
      </span>
    </div>
  );
}
