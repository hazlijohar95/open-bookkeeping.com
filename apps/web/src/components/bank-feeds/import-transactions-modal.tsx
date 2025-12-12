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

// Malaysian bank CSV presets
const BANK_PRESETS = [
  { value: "maybank", label: "Maybank", dateFormat: "DD/MM/YYYY", amountCol: 3, descCol: 2 },
  { value: "cimb", label: "CIMB Bank", dateFormat: "DD/MM/YYYY", amountCol: 4, descCol: 2 },
  { value: "public_bank", label: "Public Bank", dateFormat: "DD/MM/YYYY", amountCol: 3, descCol: 2 },
  { value: "rhb", label: "RHB Bank", dateFormat: "DD/MM/YYYY", amountCol: 3, descCol: 2 },
  { value: "hong_leong", label: "Hong Leong Bank", dateFormat: "DD/MM/YYYY", amountCol: 3, descCol: 2 },
  { value: "custom", label: "Custom/Other", dateFormat: "YYYY-MM-DD", amountCol: 2, descCol: 1 },
] as const;

function parseCSV(
  content: string,
  _preset: string
): { transactions: ParsedTransaction[]; errors: string[] } {
  const lines = content.split("\n").filter((line) => line.trim());
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    try {
      const line = lines[i];
      if (!line) {
        continue;
      }
      // Handle quoted CSV fields
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

      if (cols.length < 3) {
        errors.push(`Row ${i + 1}: Not enough columns`);
        continue;
      }

      // Parse date (handle common formats)
      const dateStr = cols[0];
      if (!dateStr) {
        errors.push(`Row ${i + 1}: Missing date`);
        continue;
      }
      let date: Date;

      if (dateStr.includes("/")) {
        // DD/MM/YYYY format (Malaysian banks)
        const parts = dateStr.split("/");
        const day = parts[0] ?? "1";
        const month = parts[1] ?? "1";
        const year = parts[2] ?? "2000";
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else if (dateStr.includes("-")) {
        // YYYY-MM-DD or DD-MM-YYYY
        const parts = dateStr.split("-");
        const firstPart = parts[0] ?? "";
        if (firstPart.length === 4) {
          date = new Date(dateStr);
        } else {
          const day = parts[0] ?? "1";
          const month = parts[1] ?? "1";
          const year = parts[2] ?? "2000";
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      } else {
        errors.push(`Row ${i + 1}: Invalid date format`);
        continue;
      }

      if (isNaN(date.getTime())) {
        errors.push(`Row ${i + 1}: Invalid date`);
        continue;
      }

      // Parse description
      const description = cols[1] ?? "No description";

      // Parse amount - handle debit/credit or single amount column
      let amount = 0;
      let type: "deposit" | "withdrawal" = "deposit";

      // Try to find the amount - check for separate debit/credit columns or single amount
      const amountStr = cols[2]?.replace(/[,\s]/g, "") ?? "0";
      const creditStr = cols[3]?.replace(/[,\s]/g, "") ?? "";

      if (creditStr && parseFloat(creditStr)) {
        // Separate debit/credit columns
        const debit = parseFloat(amountStr) ?? 0;
        const credit = parseFloat(creditStr) ?? 0;
        if (credit > 0) {
          amount = credit;
          type = "deposit";
        } else {
          amount = debit;
          type = "withdrawal";
        }
      } else {
        // Single amount column (negative = withdrawal)
        const parsed = parseFloat(amountStr);
        if (parsed < 0) {
          amount = Math.abs(parsed);
          type = "withdrawal";
        } else {
          amount = parsed;
          type = "deposit";
        }
      }

      if (amount === 0) {
        errors.push(`Row ${i + 1}: Zero amount`);
        continue;
      }

      // Balance (optional)
      const balanceStr = cols[cols.length - 1]?.replace(/[,\s]/g, "");
      const balance = balanceStr && parseFloat(balanceStr) ? balanceStr : null;

      transactions.push({
        transactionDate: date,
        description,
        reference: null,
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
        toast.success(`Imported ${result.transactionCount} transactions`);
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
