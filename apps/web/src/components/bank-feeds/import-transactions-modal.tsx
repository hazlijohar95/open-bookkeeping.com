import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileDownloadIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { Upload, FileTextIcon, AlertCircleIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useImportTransactions } from "@/api/bank-feed";

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string | null;
}

interface ImportTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  preselectedAccountId?: string | null;
}

interface ParsedTransaction {
  transactionDate: Date;
  description: string;
  reference: string | null;
  amount: string;
  type: "deposit" | "withdrawal";
  balance: string | null;
}

// Malaysian bank CSV presets with actual column mappings
// Based on common export formats from Malaysian banks
interface BankPreset {
  value: string;
  label: string;
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY";
  dateCol: number;      // Column index for date
  descCol: number;      // Column index for description
  debitCol: number;     // Column index for debit/withdrawal amount
  creditCol: number;    // Column index for credit/deposit amount (-1 if same column with sign)
  balanceCol: number;   // Column index for balance (-1 if not available)
  refCol: number;       // Column index for reference/check number (-1 if not available)
  skipRows: number;     // Number of header rows to skip
}

const BANK_PRESETS: BankPreset[] = [
  // Maybank: Date, Description, Check No, Debit, Credit, Balance
  { value: "maybank", label: "Maybank", dateFormat: "DD/MM/YYYY", dateCol: 0, descCol: 1, debitCol: 3, creditCol: 4, balanceCol: 5, refCol: 2, skipRows: 1 },
  // CIMB: Date, Description, Reference, Debit, Credit, Balance
  { value: "cimb", label: "CIMB Bank", dateFormat: "DD/MM/YYYY", dateCol: 0, descCol: 1, debitCol: 3, creditCol: 4, balanceCol: 5, refCol: 2, skipRows: 1 },
  // Public Bank: Date, Description, Debit, Credit, Balance
  { value: "public_bank", label: "Public Bank", dateFormat: "DD/MM/YYYY", dateCol: 0, descCol: 1, debitCol: 2, creditCol: 3, balanceCol: 4, refCol: -1, skipRows: 1 },
  // RHB: Date, Description, Reference, Debit, Credit, Balance
  { value: "rhb", label: "RHB Bank", dateFormat: "DD/MM/YYYY", dateCol: 0, descCol: 1, debitCol: 3, creditCol: 4, balanceCol: 5, refCol: 2, skipRows: 1 },
  // Hong Leong: Date, Description, Debit, Credit, Balance
  { value: "hong_leong", label: "Hong Leong Bank", dateFormat: "DD/MM/YYYY", dateCol: 0, descCol: 1, debitCol: 2, creditCol: 3, balanceCol: 4, refCol: -1, skipRows: 1 },
  // Custom: Auto-detect (Date, Description, Amount or Date, Description, Debit, Credit)
  { value: "custom", label: "Custom/Other", dateFormat: "YYYY-MM-DD", dateCol: 0, descCol: 1, debitCol: 2, creditCol: 3, balanceCol: -1, refCol: -1, skipRows: 1 },
];

/**
 * Parse CSV content using the selected bank preset configuration
 */
function parseCSV(
  content: string,
  presetValue: string
): { transactions: ParsedTransaction[]; errors: string[] } {
  // Get the preset configuration
  const preset = BANK_PRESETS.find((p) => p.value === presetValue) ?? BANK_PRESETS[BANK_PRESETS.length - 1]!;

  const lines = content.split("\n").filter((line) => line.trim());
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  // Skip header rows based on preset
  for (let i = preset.skipRows; i < lines.length; i++) {
    try {
      const line = lines[i];
      if (!line) {
        continue;
      }

      // Parse CSV line handling quoted fields
      const cols = parseCSVLine(line);

      // Minimum columns check based on preset
      const minCols = Math.max(preset.dateCol, preset.descCol, preset.debitCol) + 1;
      if (cols.length < minCols) {
        errors.push(`Row ${i + 1}: Not enough columns (expected at least ${minCols}, got ${cols.length})`);
        continue;
      }

      // Parse date using preset's date column and format
      const dateStr = cols[preset.dateCol]?.trim();
      if (!dateStr) {
        errors.push(`Row ${i + 1}: Missing date`);
        continue;
      }

      const date = parseDate(dateStr, preset.dateFormat);
      if (!date || isNaN(date.getTime())) {
        errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
        continue;
      }

      // Parse description using preset's description column
      const description = cols[preset.descCol]?.trim() || "No description";

      // Parse reference if available
      const reference = preset.refCol >= 0 ? cols[preset.refCol]?.trim() || null : null;

      // Parse amount using preset's debit/credit columns
      let amount = 0;
      let type: "deposit" | "withdrawal" = "deposit";

      const debitStr = cleanAmount(cols[preset.debitCol]);
      const creditStr = preset.creditCol >= 0 ? cleanAmount(cols[preset.creditCol]) : "";

      const debitAmount = parseFloat(debitStr) || 0;
      const creditAmount = parseFloat(creditStr) || 0;

      if (preset.creditCol >= 0) {
        // Separate debit/credit columns
        if (creditAmount > 0) {
          amount = creditAmount;
          type = "deposit";
        } else if (debitAmount > 0) {
          amount = debitAmount;
          type = "withdrawal";
        }
      } else {
        // Single amount column (negative = withdrawal)
        if (debitAmount < 0) {
          amount = Math.abs(debitAmount);
          type = "withdrawal";
        } else {
          amount = debitAmount;
          type = "deposit";
        }
      }

      if (amount === 0) {
        errors.push(`Row ${i + 1}: Zero amount`);
        continue;
      }

      // Parse balance if available
      let balance: string | null = null;
      if (preset.balanceCol >= 0 && cols[preset.balanceCol]) {
        const balanceStr = cleanAmount(cols[preset.balanceCol]);
        if (balanceStr && !isNaN(parseFloat(balanceStr))) {
          balance = parseFloat(balanceStr).toFixed(2);
        }
      }

      transactions.push({
        transactionDate: date,
        description,
        reference,
        amount: amount.toFixed(2),
        type,
        balance,
      });
    } catch {
      errors.push(`Row ${i + 1}: Parse error`);
    }
  }

  return { transactions, errors };
}

/**
 * Parse a CSV line handling quoted fields correctly
 */
function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let inQuote = false;
  let current = "";

  for (const char of line) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === "," && !inQuote) {
      cols.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  return cols;
}

/**
 * Parse date string using the specified format
 */
function parseDate(dateStr: string, format: BankPreset["dateFormat"]): Date | null {
  try {
    if (format === "DD/MM/YYYY" && dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]!, 10);
        const month = parseInt(parts[1]!, 10) - 1;
        const year = parseInt(parts[2]!, 10);
        return new Date(year, month, day);
      }
    } else if (format === "YYYY-MM-DD" && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3 && parts[0]!.length === 4) {
        return new Date(dateStr);
      }
    } else if (format === "DD-MM-YYYY" && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const day = parseInt(parts[0]!, 10);
        const month = parseInt(parts[1]!, 10) - 1;
        const year = parseInt(parts[2]!, 10);
        return new Date(year, month, day);
      }
    }

    // Fallback: try auto-detection
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0]!, 10);
        const month = parseInt(parts[1]!, 10) - 1;
        const year = parseInt(parts[2]!, 10);
        return new Date(year, month, day);
      }
    } else if (dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        // Check if YYYY-MM-DD or DD-MM-YYYY
        if (parts[0]!.length === 4) {
          return new Date(dateStr);
        } else {
          const day = parseInt(parts[0]!, 10);
          const month = parseInt(parts[1]!, 10) - 1;
          const year = parseInt(parts[2]!, 10);
          return new Date(year, month, day);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clean amount string by removing currency symbols, commas, and whitespace
 */
function cleanAmount(value: string | undefined): string {
  if (!value) return "0";
  return value.replace(/[RM$,\s]/gi, "").trim() || "0";
}

export function ImportTransactionsModal({
  isOpen,
  onClose,
  accounts,
  preselectedAccountId,
}: ImportTransactionsModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    (preselectedAccountId || accounts[0]?.id) ?? ""
  );
  const [selectedPreset, setSelectedPreset] = useState<string>("maybank");
  const [fileName, setFileName] = useState<string>("");
  const [parsedData, setParsedData] = useState<{
    transactions: ParsedTransaction[];
    errors: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const importMutation = useImportTransactions();

  const handleClose = () => {
    setFileName("");
    setParsedData(null);
    onClose();
  };

  const handleFileUpload = useCallback(
    (file: File) => {
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const result = parseCSV(content, selectedPreset);
        setParsedData(result);
      };
      reader.readAsText(file);
    },
    [selectedPreset]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
        handleFileUpload(file);
      } else {
        toast.error("Please upload a CSV file");
      }
    },
    [handleFileUpload]
  );

  const handleImport = () => {
    if (!parsedData?.transactions.length || !selectedAccountId) return;

    importMutation.mutate({
      bankAccountId: selectedAccountId,
      fileName,
      bankPreset: selectedPreset as any,
      transactions: parsedData.transactions.map((t) => ({
        transactionDate: t.transactionDate.toISOString().split('T')[0]!,
        description: t.description,
        reference: t.reference ?? undefined,
        amount: t.amount,
        type: t.type,
        balance: t.balance ?? undefined,
      })),
    }, {
      onSuccess: (result) => {
        const message = result.duplicatesSkipped && result.duplicatesSkipped > 0
          ? `Imported ${result.transactionCount} transactions (${result.duplicatesSkipped} duplicates skipped)`
          : `Imported ${result.transactionCount} transactions`;
        toast.success(message);
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeaderContainer>
          <DialogIcon>
            <FileDownloadIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
            <DialogDescription>
              Upload a CSV file from your bank to import transactions.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <div className="space-y-4">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName}
                      {account.bankName && ` (${account.bankName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bank Preset */}
            <div className="space-y-2">
              <Label>Bank Format</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select your bank to auto-detect the CSV format
              </p>
            </div>

            {/* File Upload Zone */}
            <div
              className={cn(
                "relative rounded-lg border-2 border-dashed p-6 transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                parsedData ? "border-solid" : ""
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {parsedData ? (
                <div className="text-center">
                  <FileTextIcon className="size-10 mx-auto mb-2 text-muted-foreground" />
                  <div className="font-medium">{fileName}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {parsedData.transactions.length} transactions found
                  </div>
                  {parsedData.errors.length > 0 && (
                    <div className="text-xs text-warning mt-2 flex items-center justify-center gap-1">
                      <AlertCircleIcon className="size-3" />
                      {parsedData.errors.length} rows skipped
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setFileName("");
                      setParsedData(null);
                    }}
                  >
                    Choose different file
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="size-10 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">
                    Drag and drop your CSV file here, or
                  </div>
                  <label className="mt-2 inline-block cursor-pointer">
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <span className="text-primary hover:underline text-sm font-medium">
                      browse to upload
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Preview Summary */}
            {parsedData && parsedData.transactions.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-sm font-medium mb-2">Preview</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Deposits:</span>
                    <span className="text-success font-medium">
                      +{parsedData.transactions.filter((t) => t.type === "deposit").length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Withdrawals:</span>
                    <span className="text-destructive font-medium">
                      -{parsedData.transactions.filter((t) => t.type === "withdrawal").length}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t mt-1">
                    <span>Date Range:</span>
                    <span>
                      {parsedData.transactions.length > 0 &&
                        `${new Date(
                          Math.min(
                            ...parsedData.transactions.map((t) => t.transactionDate.getTime())
                          )
                        ).toLocaleDateString()} - ${new Date(
                          Math.max(
                            ...parsedData.transactions.map((t) => t.transactionDate.getTime())
                          )
                        ).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={importMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleImport}
            disabled={importMutation.isPending || !parsedData?.transactions.length}
          >
            {importMutation.isPending
              ? "Importing..."
              : `Import ${parsedData?.transactions.length ?? 0} Transactions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
