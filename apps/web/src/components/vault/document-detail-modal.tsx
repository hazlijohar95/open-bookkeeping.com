import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Loader2Icon,
  Check,
  AlertCircleIcon,
  Sparkles,
  FileTextIcon,
  Building2,
  ArrowRightIcon,
  Zap,
  RefreshCw,
  CheckCircle2Icon,
  Brain,
} from "@/components/ui/icons";
import { FileFeatherIcon, FileDownloadIcon } from "@/assets/icons";
import type { VaultDocument } from "@/api/vault";
import {
  getFileIcon,
  formatFileSize,
  getDocumentTypeLabel,
  ProcessingStatusIndicator,
  ConfidenceRing,
  DataCard,
  ActionButton,
} from "./utils";

interface ProcessingResult {
  status: string;
  extractedData?: {
    documentType?: string;
    vendor?: { name: string; address?: string; taxId?: string };
    bankName?: string;
    accountNumber?: string;
    statementPeriod?: { startDate?: string; endDate?: string };
    openingBalance?: number;
    closingBalance?: number;
    currency?: string;
    transactions?: Array<{ date: string; description: string; debit?: number; credit?: number }>;
    receiptNumber?: string;
    date?: string;
    paymentMethod?: string;
    total?: number;
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    lineItems?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  };
  confidenceScore?: number | string | null;
  matchedVendor?: boolean | { id: string; name: string; email?: string };
  linkedBillId?: string | null;
  errorMessage?: string | null;
}

interface DocumentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: VaultDocument | null;
  processingResult: ProcessingResult | null;
  isLoadingResult: boolean;
  showExtractionAnimation: boolean;
  processingAvailable: boolean;
  onProcess: () => void;
  onCreateBill: () => void;
  isProcessing: boolean;
  isCreatingBill: boolean;
}

export function DocumentDetailModal({
  open,
  onOpenChange,
  document,
  processingResult,
  isLoadingResult,
  showExtractionAnimation,
  processingAvailable,
  onProcess,
  onCreateBill,
  isProcessing,
  isCreatingBill,
}: DocumentDetailModalProps) {
  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-muted/30 to-transparent">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0 border">
              {getFileIcon(document.mimeType, "size-7")}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="instrument-serif text-xl font-semibold truncate pr-8">
                {document.displayName}
              </h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <Badge variant="outline" className="capitalize font-normal">
                  {document.category.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatFileSize(document.size)}</span>
                <ProcessingStatusIndicator status={document.processingStatus} />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Document Preview */}
            {document.mimeType === "application/pdf" && document.publicUrl && (
              <a
                href={document.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-dashed p-8 text-center hover:border-primary/50 transition-colors"
              >
                <FileFeatherIcon className="size-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">View PDF Document</p>
                <p className="text-sm text-muted-foreground mt-1">Click to open in new tab</p>
              </a>
            )}

            {/* Not Processed State */}
            {document.processingStatus === "unprocessed" && processingAvailable && (
              <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Extract Data with AI</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      Let AI analyze this document to automatically extract vendor info, amounts, dates, and line items.
                    </p>
                    <Button
                      onClick={onProcess}
                      disabled={isProcessing}
                      className="mt-4"
                      size="lg"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2Icon className="size-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="size-4 mr-2" />
                          Process with AI
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Processing State */}
            {document.processingStatus === "processing" && (
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-transparent border p-8 text-center">
                <div className="relative inline-block mb-4">
                  <Brain className="size-12 text-primary animate-pulse" />
                  <span className="absolute -top-1 -right-1 size-4 bg-primary rounded-full animate-ping" />
                </div>
                <h3 className="font-semibold text-lg">AI is analyzing your document</h3>
                <p className="text-muted-foreground text-sm mt-1">This usually takes 10-30 seconds...</p>
                <div className="mt-4 flex justify-center">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="size-2 rounded-full bg-primary animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading Result */}
            {isLoadingResult && document.processingStatus === "processed" && (
              <div className="flex items-center justify-center py-12">
                <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Processed Results */}
            {processingResult?.status === "completed" && processingResult.extractedData && (
              <div className={cn(
                "space-y-6",
                showExtractionAnimation && "animate-in fade-in slide-in-from-bottom-4 duration-500"
              )}>
                {/* AI Summary Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle2Icon className="size-5 text-success" />
                    </div>
                    <div>
                      <h3 className="font-semibold">AI Extraction Complete</h3>
                      <p className="text-xs text-muted-foreground">
                        {getDocumentTypeLabel(processingResult.extractedData.documentType ?? "document")} detected
                      </p>
                    </div>
                  </div>
                  {processingResult.confidenceScore != null && (
                    <ConfidenceRing confidence={typeof processingResult.confidenceScore === 'string'
                      ? parseFloat(processingResult.confidenceScore)
                      : processingResult.confidenceScore} />
                  )}
                </div>

                {/* Bank Statement Data */}
                {processingResult.extractedData.documentType === "bank_statement" && (
                  <BankStatementData data={processingResult.extractedData} />
                )}

                {/* Receipt Data */}
                {processingResult.extractedData.documentType === "receipt" && (
                  <ReceiptData data={processingResult.extractedData} />
                )}

                {/* Invoice/Bill Data */}
                {(!processingResult.extractedData.documentType || processingResult.extractedData.documentType === "invoice" || processingResult.extractedData.documentType === "bill") && (
                  <InvoiceBillData data={processingResult.extractedData} matchedVendor={processingResult.matchedVendor} />
                )}

                {/* Actions */}
                {!processingResult.linkedBillId && (
                  <div className="rounded-xl bg-gradient-to-r from-success/10 via-success/5 to-transparent border border-success/20 p-5">
                    <h4 className="font-semibold mb-1">Ready to create a bill?</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      All extracted data will be automatically filled in.
                    </p>
                    <ActionButton
                      onClick={onCreateBill}
                      icon={<FileTextIcon className="size-4" />}
                      label="Create Bill"
                      variant="success"
                      loading={isCreatingBill}
                    />
                  </div>
                )}

                {processingResult.linkedBillId && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                    <CheckCircle2Icon className="size-5 text-success" />
                    <div>
                      <p className="font-medium text-success">Bill Created</p>
                      <p className="text-sm text-muted-foreground">This document has been converted to a bill.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {processingResult?.status === "failed" && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-5">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="size-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-destructive">Processing Failed</h4>
                    <p className="text-sm text-muted-foreground mt-1">{processingResult.errorMessage}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={onProcess}
                      disabled={isProcessing}
                    >
                      <RefreshCw className="size-3 mr-2" />
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
          <div className="flex gap-2">
            {document.publicUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={document.publicUrl} target="_blank" rel="noopener noreferrer">
                  <FileDownloadIcon className="size-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
          </div>
          {processingAvailable && document.processingStatus === "processed" && !processingResult?.linkedBillId && (
            <Button
              onClick={onCreateBill}
              disabled={isCreatingBill}
            >
              {isCreatingBill ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ArrowRightIcon className="size-4 mr-2" />
                  Create Bill
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Sub-components for different document types
function BankStatementData({ data }: { data: NonNullable<ProcessingResult["extractedData"]> }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border p-5">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="size-5 text-muted-foreground" />
          <div>
            <p className="font-semibold">{data.bankName}</p>
            {data.accountNumber && (
              <p className="text-sm text-muted-foreground">Account: {data.accountNumber}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.statementPeriod && (
            <DataCard
              label="Period"
              value={`${data.statementPeriod.startDate ?? "?"} - ${data.statementPeriod.endDate ?? "?"}`}
            />
          )}
          {data.openingBalance !== undefined && (
            <DataCard
              label="Opening"
              value={`${data.currency ?? "MYR"} ${data.openingBalance.toLocaleString()}`}
            />
          )}
          {data.closingBalance !== undefined && (
            <DataCard
              label="Closing"
              value={`${data.currency ?? "MYR"} ${data.closingBalance.toLocaleString()}`}
              trend={data.closingBalance >= (data.openingBalance ?? 0) ? "up" : "down"}
            />
          )}
        </div>
      </div>

      {/* Transactions */}
      {data.transactions && data.transactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Transactions</h4>
            <Badge variant="secondary">{data.transactions.length} found</Badge>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/80 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.transactions.map((tx, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap font-mono text-xs">{tx.date}</td>
                      <td className="p-3">{tx.description}</td>
                      <td className={cn(
                        "p-3 text-right font-medium tabular-nums",
                        tx.debit ? "text-destructive" : "text-success"
                      )}>
                        {tx.debit ? `-${tx.debit.toLocaleString()}` : `+${(tx.credit ?? 0).toLocaleString()}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptData({ data }: { data: NonNullable<ProcessingResult["extractedData"]> }) {
  return (
    <div className="space-y-4">
      {data.vendor && (
        <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Merchant</p>
          <p className="font-semibold text-lg">{data.vendor.name}</p>
          {data.vendor.address && (
            <p className="text-sm text-muted-foreground mt-1">{data.vendor.address}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.receiptNumber && (
          <DataCard label="Receipt #" value={data.receiptNumber} />
        )}
        {data.date && (
          <DataCard label="Date" value={data.date} />
        )}
        {data.paymentMethod && (
          <DataCard label="Payment" value={data.paymentMethod} />
        )}
        {data.total !== undefined && (
          <DataCard
            label="Total"
            value={`${data.currency ?? "MYR"} ${data.total.toLocaleString()}`}
          />
        )}
      </div>
    </div>
  );
}

function InvoiceBillData({ data, matchedVendor }: { data: NonNullable<ProcessingResult["extractedData"]>; matchedVendor?: boolean | { id: string; name: string; email?: string } }) {
  const isMatched = typeof matchedVendor === 'object' ? !!matchedVendor : matchedVendor;
  return (
    <div className="space-y-4">
      {data.vendor && (
        <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Vendor</p>
              <p className="font-semibold text-lg">{data.vendor.name}</p>
              {data.vendor.address && (
                <p className="text-sm text-muted-foreground mt-1">{data.vendor.address}</p>
              )}
              {data.vendor.taxId && (
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Tax ID:</span> {data.vendor.taxId}
                </p>
              )}
            </div>
            {isMatched && (
              <Badge className="bg-success/10 text-success border-success/20">
                <Check className="size-3 mr-1" />
                Matched
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {data.invoiceNumber && (
          <DataCard label="Invoice #" value={data.invoiceNumber} />
        )}
        {data.invoiceDate && (
          <DataCard label="Date" value={data.invoiceDate} />
        )}
        {data.dueDate && (
          <DataCard label="Due Date" value={data.dueDate} />
        )}
        {data.total !== undefined && (
          <DataCard
            label="Total"
            value={`${data.currency ?? "MYR"} ${data.total.toLocaleString()}`}
          />
        )}
      </div>

      {/* Line Items */}
      {data.lineItems && data.lineItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Line Items</h4>
            <Badge variant="secondary">{data.lineItems.length} items</Badge>
          </div>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/80">
                <tr>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Qty</th>
                  <th className="text-right p-3 font-medium">Price</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.lineItems.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">{item.description}</td>
                    <td className="p-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="p-3 text-right tabular-nums">{item.unitPrice?.toLocaleString()}</td>
                    <td className="p-3 text-right font-medium tabular-nums">{item.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
