import React, { useState } from "react";
import { Download, Eye, FileTextIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ReportsViewProps {
  formatAmount: (amount: number) => string;
}

const ReportsView = ({ formatAmount }: ReportsViewProps) => {
  const [selectedReport, setSelectedReport] = useState("profit-loss");

  const reports = [
    { id: "profit-loss", name: "Profit & Loss", description: "Income and expense summary" },
    { id: "balance-sheet", name: "Balance Sheet", description: "Assets, liabilities, equity" },
    { id: "cash-flow", name: "Cash Flow", description: "Money in and out" },
    { id: "aged-receivables", name: "Aged Receivables", description: "Outstanding customer payments" },
    { id: "aged-payables", name: "Aged Payables", description: "Outstanding vendor bills" },
    { id: "tax-summary", name: "Tax Summary", description: "SST and tax obligations" },
  ];

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Reports</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Financial reports and analytics</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium border border-border/50 hover:border-border transition-colors">
            <Download className="size-3.5" />
            Export All
          </button>
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {reports.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={cn(
                  "p-4 border text-left transition-all cursor-pointer",
                  selectedReport === report.id
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-border hover:bg-muted/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[13px] font-medium">{report.name}</span>
                    <p className="text-[11px] text-muted-foreground mt-1">{report.description}</p>
                  </div>
                  <FileTextIcon className="size-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <span className="text-[14px] font-semibold">
            {reports.find(r => r.id === selectedReport)?.name}
          </span>
          <p className="text-[11px] text-muted-foreground mt-1">December 2024</p>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          {selectedReport === "profit-loss" && (
            <>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Revenue</span>
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">{formatAmount(65500)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">Expenses</span>
                <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400 mt-1">{formatAmount(12300)}</p>
              </div>
              <div className="pt-3 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase">Net Profit</span>
                <p className="text-xl font-bold tabular-nums mt-1">{formatAmount(53200)}</p>
              </div>
            </>
          )}
          {selectedReport !== "profit-loss" && (
            <div className="text-[12px] text-muted-foreground">
              Select to view report details
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border/30 space-y-2">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Eye className="size-3.5" />
            View Full Report
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <Download className="size-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(ReportsView);
