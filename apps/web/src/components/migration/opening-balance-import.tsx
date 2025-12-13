/**
 * Opening Balance CSV Import Component
 * Specialized import dialog for trial balance / opening balances
 */

import { useCallback } from "react";
import { CSVImportDialog } from "./csv-import-dialog";
import {
  openingBalanceMappings,
  templates,
  type OpeningBalanceRow,
} from "@/lib/csv-parser";
import { useBulkAddOpeningBalances } from "@/api/migration";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface OpeningBalanceImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onSuccess?: () => void;
}

export function OpeningBalanceImport({
  open,
  onOpenChange,
  sessionId,
  onSuccess,
}: OpeningBalanceImportProps) {
  const addBalances = useBulkAddOpeningBalances();

  const handleImport = useCallback(
    async (data: OpeningBalanceRow[]) => {
      // Transform to API format
      const entries = data.map((row) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        accountType: row.accountType as "asset" | "liability" | "equity" | "revenue" | "expense",
        debitAmount: row.debitAmount || "0.00",
        creditAmount: row.creditAmount || "0.00",
      }));

      await addBalances.mutateAsync({
        sessionId,
        entries,
      });

      toast.success(`Successfully imported ${entries.length} opening balances`);
      onSuccess?.();
    },
    [addBalances, sessionId, onSuccess]
  );

  const renderPreview = useCallback((data: OpeningBalanceRow[]) => {
    // Calculate totals
    const totals = data.reduce(
      (acc, row) => ({
        debits: acc.debits + parseFloat(row.debitAmount || "0"),
        credits: acc.credits + parseFloat(row.creditAmount || "0"),
      }),
      { debits: 0, credits: 0 }
    );

    return (
      <div className="space-y-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 font-medium">Code</th>
              <th className="text-left py-1 font-medium">Account</th>
              <th className="text-left py-1 font-medium">Type</th>
              <th className="text-right py-1 font-medium">Debit</th>
              <th className="text-right py-1 font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-b border-dashed">
                <td className="py-1.5 font-mono">{row.accountCode}</td>
                <td className="py-1.5">{row.accountName}</td>
                <td className="py-1.5 capitalize">{row.accountType}</td>
                <td className="py-1.5 text-right text-emerald-600">
                  {parseFloat(row.debitAmount || "0") > 0
                    ? formatCurrency(parseFloat(row.debitAmount))
                    : "-"}
                </td>
                <td className="py-1.5 text-right text-rose-600">
                  {parseFloat(row.creditAmount || "0") > 0
                    ? formatCurrency(parseFloat(row.creditAmount))
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals summary */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-xs">
          <span className="font-medium">Preview Totals:</span>
          <div className="flex gap-4">
            <span className="text-emerald-600">
              Debits: {formatCurrency(totals.debits)}
            </span>
            <span className="text-rose-600">
              Credits: {formatCurrency(totals.credits)}
            </span>
            <span className={totals.debits === totals.credits ? "text-emerald-600" : "text-amber-600"}>
              {totals.debits === totals.credits
                ? "Balanced"
                : `Difference: ${formatCurrency(Math.abs(totals.debits - totals.credits))}`}
            </span>
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <CSVImportDialog<OpeningBalanceRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Import Opening Balances"
      description="Import your trial balance from a CSV file. Ensure debits equal credits."
      mappings={openingBalanceMappings}
      templateContent={templates.openingBalances}
      templateFilename="opening_balances_template.csv"
      onImport={handleImport}
      renderPreview={renderPreview}
    />
  );
}
