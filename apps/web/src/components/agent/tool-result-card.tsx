"use client";

import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Loader2Icon,
  Wrench,
  Copy,
  CheckIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

// Tool name to friendly label mapping
const TOOL_LABELS: Record<string, string> = {
  getDashboardStats: "Dashboard Statistics",
  listInvoices: "Invoices List",
  getInvoiceDetails: "Invoice Details",
  getAgingReport: "Aging Report",
  listCustomers: "Customers List",
  searchCustomers: "Customer Search",
  getCustomerInvoices: "Customer Invoices",
  listQuotations: "Quotations List",
  listBills: "Bills List",
  getBillDetails: "Bill Details",
  listVendors: "Vendors List",
  getAccountBalance: "Account Balance",
  getTrialBalance: "Trial Balance",
  getProfitLoss: "Profit & Loss",
  getProfitAndLoss: "Profit & Loss",
  getBalanceSheet: "Balance Sheet",
  getAccountingPeriodStatus: "Period Status",
  searchLedgerTransactions: "Transactions",
  getUnpaidBills: "Unpaid Bills",
  createInvoice: "Invoice Created",
  createBill: "Bill Created",
  createCustomer: "Customer Created",
  createVendor: "Vendor Created",
  createJournalEntry: "Journal Entry Created",
  postJournalEntry: "Posted to Ledger",
  reverseJournalEntry: "Entry Reversed",
  markInvoiceAsPaid: "Invoice Marked Paid",
  markBillAsPaid: "Bill Marked Paid",
  updateInvoiceStatus: "Invoice Updated",
  updateQuotationStatus: "Quotation Updated",
  convertQuotationToInvoice: "Quotation Converted",
  listAccounts: "Chart of Accounts",
  rememberPreference: "Preference Saved",
  recallMemories: "Memories",
  updateUserContext: "Context Updated",
  thinkStep: "Reasoning",
  validateAction: "Validation",
  listVaultDocuments: "Vault Documents",
  processDocuments: "Document Processing",
  getDocumentDetails: "Document Details",
  queryDocumentCabinet: "Document Search",
  createEntriesFromDocument: "Entries Created",
};

// Action labels (shown while processing)
const TOOL_ACTION_LABELS: Record<string, string> = {
  getDashboardStats: "Fetching dashboard statistics",
  listInvoices: "Loading invoices",
  getInvoiceDetails: "Getting invoice details",
  getAgingReport: "Generating aging report",
  listCustomers: "Loading customers",
  searchCustomers: "Searching customers",
  getCustomerInvoices: "Getting customer invoices",
  listQuotations: "Loading quotations",
  listBills: "Loading bills",
  getBillDetails: "Getting bill details",
  listVendors: "Loading vendors",
  getAccountBalance: "Getting account balance",
  getTrialBalance: "Generating trial balance",
  getProfitLoss: "Generating profit & loss",
  getProfitAndLoss: "Generating profit & loss",
  getBalanceSheet: "Generating balance sheet",
  createInvoice: "Creating invoice",
  createBill: "Creating bill",
  createCustomer: "Creating customer",
  createVendor: "Creating vendor",
  createJournalEntry: "Creating journal entry",
  postJournalEntry: "Posting to ledger",
  reverseJournalEntry: "Reversing entry",
  markInvoiceAsPaid: "Marking invoice as paid",
  markBillAsPaid: "Marking bill as paid",
  listAccounts: "Loading accounts",
  rememberPreference: "Saving preference",
  recallMemories: "Recalling memories",
  updateUserContext: "Updating context",
  thinkStep: "Planning approach",
  validateAction: "Validating action",
  listVaultDocuments: "Loading documents",
  processDocuments: "Processing documents",
  getDocumentDetails: "Getting document details",
  queryDocumentCabinet: "Searching documents",
  createEntriesFromDocument: "Creating entries",
};

interface ToolResultCardProps {
  toolName: string;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

// Format output for display
function formatOutput(output: unknown): string {
  if (output === null || output === undefined) {
    return "No data returned";
  }

  if (typeof output === "string") {
    return output;
  }

  if (typeof output === "number" || typeof output === "boolean") {
    return String(output);
  }

  // For objects, create a readable format
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

// Get summary of output for collapsed view
function getOutputSummary(output: unknown, toolName: string): string | null {
  if (!output || typeof output !== "object") return null;

  const data = output as Record<string, unknown>;

  // Handle common response patterns
  if (Array.isArray(data)) {
    return `${data.length} item${data.length !== 1 ? "s" : ""}`;
  }

  // Handle wrapped responses (e.g., { data: [...] })
  if (data.data && Array.isArray(data.data)) {
    return `${data.data.length} item${data.data.length !== 1 ? "s" : ""}`;
  }

  // Handle invoice/bill details
  if (data.invoiceNumber || data.billNumber) {
    const num = data.invoiceNumber || data.billNumber;
    const total = data.totalAmount || data.total;
    return `#${num}${total ? ` - ${formatCurrency(total)}` : ""}`;
  }

  // Handle customer/vendor
  if (data.name && (toolName.includes("Customer") || toolName.includes("Vendor"))) {
    return String(data.name);
  }

  // Handle financial reports
  if (data.netIncome !== undefined) {
    return `Net Income: ${formatCurrency(data.netIncome)}`;
  }

  if (data.totalAssets !== undefined) {
    return `Total Assets: ${formatCurrency(data.totalAssets)}`;
  }

  // Handle dashboard stats
  if (data.revenue !== undefined || data.totalRevenue !== undefined) {
    const revenue = data.revenue ?? data.totalRevenue;
    return `Revenue: ${formatCurrency(revenue)}`;
  }

  // Handle success messages
  if (data.success === true && data.message) {
    return String(data.message);
  }

  if (data.id && data.message) {
    return String(data.message);
  }

  // Handle memories
  if (toolName === "recallMemories" && data.memories && Array.isArray(data.memories)) {
    return `${data.memories.length} memor${data.memories.length !== 1 ? "ies" : "y"} found`;
  }

  return null;
}

function formatCurrency(value: unknown): string {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(num);
}

export const ToolResultCard = memo(function ToolResultCard({
  toolName,
  toolCallId: _toolCallId,
  state,
  input: _input,
  output,
  errorText,
}: ToolResultCardProps) {
  // _toolCallId and _input are reserved for future use (e.g., showing input params in expanded view)
  void _toolCallId;
  void _input;
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isComplete = state === "output-available";
  const isError = state === "output-error";
  const isStreaming = state === "input-streaming";
  const isInputAvailable = state === "input-available";

  const resultLabel = TOOL_LABELS[toolName] || toolName;
  const actionLabel = TOOL_ACTION_LABELS[toolName] || toolName;
  const summary = isComplete && output ? getOutputSummary(output, toolName) : null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatOutput(output);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show simple streaming/input state
  if (isStreaming || isInputAvailable) {
    return (
      <div
        className="flex items-center gap-2 text-xs bg-muted/50 rounded-none px-2 py-1.5 my-1 border-l-2 border-primary/30 text-muted-foreground"
      >
        <Loader2Icon className="h-3 w-3 animate-spin" />
        <Wrench className="h-3 w-3" />
        <span className="jetbrains-mono">{actionLabel}...</span>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="my-1">
        <div
          className={cn(
            "flex items-center gap-2 text-xs bg-destructive/10 rounded-none px-2 py-1.5 border-l-2 border-destructive/50 text-destructive cursor-pointer hover:bg-destructive/15 transition-colors",
            isExpanded && "rounded-b-none"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <AlertTriangleIcon className="h-3 w-3 shrink-0" />
          <Wrench className="h-3 w-3 shrink-0" />
          <span className="jetbrains-mono flex-1">{resultLabel} - Error</span>
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 shrink-0" />
          )}
        </div>
        {isExpanded && errorText && (
          <div className="bg-destructive/5 border-l-2 border-destructive/50 px-3 py-2 text-xs text-destructive/90 jetbrains-mono whitespace-pre-wrap">
            {errorText}
          </div>
        )}
      </div>
    );
  }

  // Complete state with output
  if (isComplete) {
    const hasOutput = output !== null && output !== undefined;
    const canExpand = hasOutput;

    return (
      <div className="my-1">
        <div
          className={cn(
            "flex items-center gap-2 text-xs bg-muted/50 rounded-none px-2 py-1.5 border-l-2 border-emerald-500/30 text-muted-foreground",
            canExpand && "cursor-pointer hover:bg-muted/70 transition-colors",
            isExpanded && "rounded-b-none border-b-0"
          )}
          onClick={() => canExpand && setIsExpanded(!isExpanded)}
        >
          <CheckCircle2Icon className="h-3 w-3 text-emerald-500 shrink-0" />
          <Wrench className="h-3 w-3 shrink-0" />
          <span className="jetbrains-mono flex-1 truncate">
            {resultLabel}
            {summary && (
              <span className="text-muted-foreground/70 ml-1.5">
                ({summary})
              </span>
            )}
          </span>
          {canExpand && (
            isExpanded ? (
              <ChevronDownIcon className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRightIcon className="h-3 w-3 shrink-0" />
            )
          )}
        </div>
        {isExpanded && hasOutput && (
          <div className="bg-muted/30 border border-t-0 border-muted px-3 py-2 text-xs">
            <div className="flex justify-end mb-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-2.5 w-2.5 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-2.5 w-2.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="jetbrains-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto text-muted-foreground">
              {formatOutput(output)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-none px-2 py-1.5 my-1 border-l-2 border-primary/30 text-muted-foreground">
      <Loader2Icon className="h-3 w-3 animate-spin" />
      <Wrench className="h-3 w-3" />
      <span className="jetbrains-mono">{actionLabel}</span>
    </div>
  );
});
