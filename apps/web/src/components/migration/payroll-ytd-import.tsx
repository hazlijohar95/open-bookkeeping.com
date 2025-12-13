/**
 * Payroll YTD CSV Import Component
 * Specialized import dialog for year-to-date payroll figures
 */

import { useCallback } from "react";
import { CSVImportDialog } from "./csv-import-dialog";
import {
  payrollYtdMappings,
  templates,
  type PayrollYtdRow,
} from "@/lib/csv-parser";
import { useBulkAddPayrollYtd } from "@/api/migration";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface PayrollYtdImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onSuccess?: () => void;
}

export function PayrollYtdImport({
  open,
  onOpenChange,
  sessionId,
  onSuccess,
}: PayrollYtdImportProps) {
  const bulkAddPayrollYtd = useBulkAddPayrollYtd();

  const handleImport = useCallback(
    async (data: PayrollYtdRow[]) => {
      // Transform to API format
      const records = data.map((row) => ({
        employeeId: row.employeeId,
        asOfDate: row.asOfDate,
        monthsWorked: parseInt(row.monthsWorked, 10) || 0,
        ytdGrossSalary: row.ytdGrossSalary || "0.00",
        ytdBaseSalary: row.ytdBaseSalary || "0.00",
        ytdAllowances: row.ytdAllowances || "0.00",
        ytdOtherEarnings: row.ytdOtherEarnings || "0.00",
        ytdTotalDeductions: row.ytdTotalDeductions || "0.00",
        ytdOtherDeductions: row.ytdOtherDeductions || "0.00",
        ytdEpfEmployee: row.ytdEpfEmployee || "0.00",
        ytdSocsoEmployee: row.ytdSocsoEmployee || "0.00",
        ytdEisEmployee: row.ytdEisEmployee || "0.00",
        ytdPcb: row.ytdPcb || "0.00",
        ytdEpfEmployer: row.ytdEpfEmployer || "0.00",
        ytdSocsoEmployer: row.ytdSocsoEmployer || "0.00",
        ytdEisEmployer: row.ytdEisEmployer || "0.00",
        ytdNetSalary: row.ytdNetSalary || "0.00",
      }));

      await bulkAddPayrollYtd.mutateAsync({
        sessionId,
        records,
      });

      toast.success(`Successfully imported ${records.length} employee YTD records`);
      onSuccess?.();
    },
    [bulkAddPayrollYtd, sessionId, onSuccess]
  );

  const renderPreview = useCallback((data: PayrollYtdRow[]) => {
    // Calculate totals
    const totals = data.reduce(
      (acc, row) => ({
        grossSalary: acc.grossSalary + parseFloat(row.ytdGrossSalary || "0"),
        epf: acc.epf + parseFloat(row.ytdEpfEmployee || "0"),
        socso: acc.socso + parseFloat(row.ytdSocsoEmployee || "0"),
        eis: acc.eis + parseFloat(row.ytdEisEmployee || "0"),
        pcb: acc.pcb + parseFloat(row.ytdPcb || "0"),
        netSalary: acc.netSalary + parseFloat(row.ytdNetSalary || "0"),
      }),
      { grossSalary: 0, epf: 0, socso: 0, eis: 0, pcb: 0, netSalary: 0 }
    );

    return (
      <div className="space-y-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 font-medium">Employee</th>
              <th className="text-right py-1 font-medium">YTD Gross</th>
              <th className="text-right py-1 font-medium">EPF</th>
              <th className="text-right py-1 font-medium">SOCSO</th>
              <th className="text-right py-1 font-medium">EIS</th>
              <th className="text-right py-1 font-medium">PCB</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-b border-dashed">
                <td className="py-1.5">
                  {row.employeeName || row.employeeCode || row.employeeId.slice(0, 8)}
                </td>
                <td className="py-1.5 text-right">
                  {formatCurrency(parseFloat(row.ytdGrossSalary || "0"))}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">
                  {formatCurrency(parseFloat(row.ytdEpfEmployee || "0"))}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">
                  {formatCurrency(parseFloat(row.ytdSocsoEmployee || "0"))}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">
                  {formatCurrency(parseFloat(row.ytdEisEmployee || "0"))}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">
                  {formatCurrency(parseFloat(row.ytdPcb || "0"))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals summary */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-xs">
          <div>
            <span className="text-muted-foreground">Total Gross: </span>
            <span className="font-medium">{formatCurrency(totals.grossSalary)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total EPF: </span>
            <span className="font-medium">{formatCurrency(totals.epf)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total PCB: </span>
            <span className="font-medium">{formatCurrency(totals.pcb)}</span>
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <CSVImportDialog<PayrollYtdRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Import Payroll YTD"
      description="Import year-to-date payroll figures for accurate statutory calculations when migrating mid-year."
      mappings={payrollYtdMappings}
      templateContent={templates.payrollYtd}
      templateFilename="payroll_ytd_template.csv"
      onImport={handleImport}
      renderPreview={renderPreview}
    />
  );
}
