/**
 * Pay Slip Detail Modal
 * View detailed pay slip information and download PDF
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogIcon,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DownloadIcon, Loader2Icon, UserIcon, BankIcon, TrendingUpIcon, TrendingDownIcon } from "@/components/ui/icons";
import { ReceiptIcon } from "@/assets/icons";
import type { PaySlipItem as PaySlipItemType } from "@/api/payroll";
import { usePaySlip } from "@/api/payroll";
import { formatCurrency } from "@/lib/utils";
import { pdf } from "@react-pdf/renderer";
import PaySlipPDF from "@/components/pdf/payroll/pay-slip-pdf";
import type { PaySlipPDFData, PaySlipItem } from "@/components/pdf/payroll/pay-slip-pdf";
import { toast } from "sonner";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  calculated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface PaySlipDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  paySlipId: string | null;
  periodYear?: number;
  periodMonth?: number;
}

export function PaySlipDetailModal({
  isOpen,
  onClose,
  paySlipId,
  periodYear,
  periodMonth,
}: PaySlipDetailModalProps) {
  const { data: paySlipData, isLoading } = usePaySlip(paySlipId || "");
  const [isDownloading, setIsDownloading] = useState(false);

  // The paySlipData is the paySlip itself with items attached
  const paySlip = paySlipData;
  const items = paySlipData?.items || [];

  const periodLabel = useMemo(() => {
    if (periodYear && periodMonth) {
      return `${monthNames[periodMonth - 1]} ${periodYear}`;
    }
    return "Pay Slip";
  }, [periodYear, periodMonth]);

  const earnings = useMemo(
    () => items.filter((i: PaySlipItemType) => i.componentType === "earnings"),
    [items]
  );

  const deductions = useMemo(
    () => items.filter((i: PaySlipItemType) => i.componentType === "deductions"),
    [items]
  );

  const handleDownloadPDF = async () => {
    if (!paySlip) return;

    setIsDownloading(true);
    try {
      const pdfData: PaySlipPDFData = {
        employeeCode: paySlip.employeeCode,
        employeeName: paySlip.employeeName,
        department: paySlip.department,
        position: paySlip.position,
        icNumber: paySlip.icNumber,
        bankName: paySlip.bankName,
        bankAccountNumber: paySlip.bankAccountNumber,
        periodYear: periodYear || new Date().getFullYear(),
        periodMonth: periodMonth || new Date().getMonth() + 1,
        payDate: new Date().toISOString(),
        baseSalary: parseFloat(paySlip.baseSalary),
        workingDays: paySlip.workingDays,
        daysWorked: paySlip.daysWorked,
        items: items.map((item: PaySlipItemType): PaySlipItem => ({
          code: item.componentCode,
          name: item.componentName,
          type: item.componentType,
          amount: parseFloat(item.amount),
        })),
        epfEmployee: parseFloat(paySlip.epfEmployee || "0"),
        epfEmployer: parseFloat(paySlip.epfEmployer || "0"),
        socsoEmployee: parseFloat(paySlip.socsoEmployee || "0"),
        socsoEmployer: parseFloat(paySlip.socsoEmployer || "0"),
        eisEmployee: parseFloat(paySlip.eisEmployee || "0"),
        eisEmployer: parseFloat(paySlip.eisEmployer || "0"),
        pcb: parseFloat(paySlip.pcb || "0"),
        totalEarnings: parseFloat(paySlip.totalEarnings || paySlip.grossSalary || "0"),
        grossSalary: parseFloat(paySlip.grossSalary || "0"),
        totalDeductions: parseFloat(paySlip.totalDeductions || "0"),
        netSalary: parseFloat(paySlip.netSalary || "0"),
        ytdGrossSalary: paySlip.ytdGrossSalary ? parseFloat(paySlip.ytdGrossSalary) : null,
        ytdEpfEmployee: paySlip.ytdEpfEmployee ? parseFloat(paySlip.ytdEpfEmployee) : null,
        ytdPcb: paySlip.ytdPcb ? parseFloat(paySlip.ytdPcb) : null,
        slipNumber: paySlip.slipNumber,
        currency: "MYR",
        generatedAt: new Date().toISOString(),
      };

      const blob = await pdf(<PaySlipPDF data={pdfData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PaySlip-${paySlip.employeeCode}-${periodLabel.replace(" ", "-")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Pay slip downloaded");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!paySlipId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogIcon>
            <ReceiptIcon className="size-5" />
          </DialogIcon>
          <DialogTitle>Pay Slip - {periodLabel}</DialogTitle>
          <DialogDescription>
            {paySlip ? (
              <span className="flex items-center gap-2">
                {paySlip.employeeName} ({paySlip.employeeCode})
                <Badge variant="outline" className={statusColors[paySlip.status]}>
                  {paySlip.status}
                </Badge>
              </span>
            ) : (
              "Loading pay slip details..."
            )}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-12"
            >
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </motion.div>
          ) : paySlip ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Employee Info Card */}
              <section
                className="rounded-xl border bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 p-4"
                aria-label="Employee Information"
              >
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0" aria-hidden="true">
                    <UserIcon className="size-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{paySlip.employeeName}</h3>
                      <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {paySlip.employeeCode}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      {paySlip.position && <span>{paySlip.position}</span>}
                      {paySlip.department && (
                        <>
                          {paySlip.position && <span className="text-muted-foreground/50" aria-hidden="true">•</span>}
                          <span>{paySlip.department}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Earnings & Deductions Side by Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="region" aria-label="Salary breakdown">
                {/* Earnings */}
                <section
                  className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10 p-4"
                  aria-labelledby="earnings-heading"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center" aria-hidden="true">
                      <TrendingUpIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 id="earnings-heading" className="font-semibold text-emerald-700 dark:text-emerald-400">Earnings</h3>
                  </div>
                  <dl className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">Basic Salary</dt>
                      <dd className="font-mono font-medium">{formatCurrency(parseFloat(paySlip.baseSalary))}</dd>
                    </div>
                    {earnings.map((item: PaySlipItemType) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <dt className="text-muted-foreground">{item.componentName}</dt>
                        <dd className="font-mono font-medium">{formatCurrency(parseFloat(item.amount))}</dd>
                      </div>
                    ))}
                    <Separator className="!my-3 bg-emerald-200/50 dark:bg-emerald-700/30" />
                    <div className="flex justify-between text-sm font-semibold">
                      <dt>Gross Salary</dt>
                      <dd className="font-mono text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(parseFloat(paySlip.grossSalary || "0"))}
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Deductions */}
                <section
                  className="rounded-xl border bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 p-4"
                  aria-labelledby="deductions-heading"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center" aria-hidden="true">
                      <TrendingDownIcon className="size-4 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 id="deductions-heading" className="font-semibold text-red-700 dark:text-red-400">Deductions</h3>
                  </div>
                  <dl className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">EPF (Employee)</dt>
                      <dd className="font-mono font-medium">{formatCurrency(parseFloat(paySlip.epfEmployee || "0"))}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">SOCSO (Employee)</dt>
                      <dd className="font-mono font-medium">{formatCurrency(parseFloat(paySlip.socsoEmployee || "0"))}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">EIS (Employee)</dt>
                      <dd className="font-mono font-medium">{formatCurrency(parseFloat(paySlip.eisEmployee || "0"))}</dd>
                    </div>
                    <div className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">PCB / Tax</dt>
                      <dd className="font-mono font-medium">{formatCurrency(parseFloat(paySlip.pcb || "0"))}</dd>
                    </div>
                    {deductions.map((item: PaySlipItemType) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <dt className="text-muted-foreground">{item.componentName}</dt>
                        <dd className="font-mono font-medium">{formatCurrency(parseFloat(item.amount))}</dd>
                      </div>
                    ))}
                    <Separator className="!my-3 bg-red-200/50 dark:bg-red-700/30" />
                    <div className="flex justify-between text-sm font-semibold">
                      <dt>Total Deductions</dt>
                      <dd className="font-mono text-red-700 dark:text-red-400">
                        {formatCurrency(parseFloat(paySlip.totalDeductions || "0"))}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              {/* Net Pay - Highlighted */}
              <motion.section
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="p-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                aria-label={`Net Pay: ${formatCurrency(parseFloat(paySlip.netSalary || "0"))}`}
                role="status"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-primary-foreground/80 font-medium">Net Pay</p>
                    <p className="text-3xl font-bold font-mono tracking-tight" aria-hidden="true">
                      {formatCurrency(parseFloat(paySlip.netSalary || "0"))}
                    </p>
                  </div>
                  <div className="size-14 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
                    <BankIcon className="size-7" />
                  </div>
                </div>
              </motion.section>

              {/* Employer Contributions */}
              <section className="rounded-xl border bg-muted/30 p-4" aria-labelledby="employer-contributions-heading">
                <h3 id="employer-contributions-heading" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Employer Contributions
                </h3>
                <dl className="flex flex-wrap gap-2">
                  {[
                    { label: "EPF", value: paySlip.epfEmployer },
                    { label: "SOCSO", value: paySlip.socsoEmployer },
                    { label: "EIS", value: paySlip.eisEmployer },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="px-3 py-2 rounded-lg bg-background border flex items-center gap-2"
                    >
                      <dt className="text-xs text-muted-foreground">{item.label}</dt>
                      <dd className="font-mono text-sm font-medium">
                        {formatCurrency(parseFloat(item.value || "0"))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Download Button */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleDownloadPDF} disabled={isDownloading} size="lg">
                  {isDownloading ? (
                    <Loader2Icon className="size-4 mr-2 animate-spin" />
                  ) : (
                    <DownloadIcon className="size-4 mr-2" />
                  )}
                  Download PDF
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 text-muted-foreground"
            >
              Pay slip not found
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
