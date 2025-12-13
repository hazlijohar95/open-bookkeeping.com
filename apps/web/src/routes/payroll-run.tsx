/**
 * Payroll Run Detail Page
 * View pay slips and manage a specific payroll run
 */

import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useCallback } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  usePayrollRun,
  usePaySlips,
  useCalculatePayroll,
  useApprovePayrollRun,
  useFinalizePayrollRun,
  useMarkPayrollPaid,
  useCancelPayrollRun,
  useEmployeeStats,
} from "@/api/payroll";
import type { PaySlip, PayrollRunStatus } from "@/api/payroll";
import {
  CalendarIcon,
  ArrowLeft,
  CheckCircleIcon,
  XCircleIcon,
  Loader2Icon,
  Eye,
  CoinsIcon,
  BankIcon,
  FileTextIcon,
  TrendingUpIcon,
  InfoIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "@/components/ui/icons";
import { formatCurrency, cn } from "@/lib/utils";
import { MetricCard } from "@/components/dashboard";
import { toast } from "sonner";
import { createColumnHelper } from "@tanstack/react-table";
import { HeaderColumnButton } from "@/components/ui/data-table";
import { createColumnConfigHelper } from "@/components/ui/data-table-filter/core/filters";
import { CalendarPenIcon } from "@/assets/icons";
import { PaySlipDetailModal } from "@/components/payroll/pay-slip-detail-modal";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Variance Detection Types
 */
type VarianceType = "warning" | "info" | "error";

interface PaySlipVariance {
  type: VarianceType;
  field: string;
  message: string;
}

/**
 * Detect variances/anomalies in a pay slip
 * Helps accountants identify issues during review
 */
function detectPaySlipVariances(paySlip: PaySlip): PaySlipVariance[] {
  const variances: PaySlipVariance[] = [];

  const grossSalary = parseFloat(paySlip.grossSalary || "0");
  const epfEmployee = parseFloat(paySlip.epfEmployee || "0");
  const socsoEmployee = parseFloat(paySlip.socsoEmployee || "0");
  const eisEmployee = parseFloat(paySlip.eisEmployee || "0");
  const pcb = parseFloat(paySlip.pcb || "0");

  // Check for zero EPF when gross salary exists
  if (grossSalary > 0 && epfEmployee === 0) {
    variances.push({
      type: "warning",
      field: "epf",
      message: "No EPF deduction - verify if employee is exempt (foreign/60+)",
    });
  }

  // Check for zero SOCSO when gross salary exists
  if (grossSalary > 0 && socsoEmployee === 0) {
    variances.push({
      type: "info",
      field: "socso",
      message: "No SOCSO deduction - verify if employee is exempt (foreign/60+)",
    });
  }

  // Check for zero EIS when gross salary exists
  if (grossSalary > 0 && eisEmployee === 0) {
    variances.push({
      type: "info",
      field: "eis",
      message: "No EIS deduction - verify if employee is exempt (foreign/60+)",
    });
  }

  // Check for zero PCB when gross is above tax threshold (approx RM3,000/month after reliefs)
  if (grossSalary > 4000 && pcb === 0) {
    variances.push({
      type: "info",
      field: "pcb",
      message: "No PCB - verify tax reliefs are correctly applied",
    });
  }

  // Check for unusually low net salary ratio (< 50% of gross suggests high deductions)
  const netSalary = parseFloat(paySlip.netSalary || "0");
  const netRatio = netSalary / grossSalary;
  if (grossSalary > 0 && netRatio < 0.5) {
    variances.push({
      type: "warning",
      field: "net",
      message: `Net pay is ${(netRatio * 100).toFixed(0)}% of gross - unusually high deductions`,
    });
  }

  return variances;
}

/**
 * Variance Indicator Component
 */
function VarianceIndicator({ variances }: { variances: PaySlipVariance[] }) {
  if (variances.length === 0) return null;

  const hasWarnings = variances.some((v) => v.type === "warning" || v.type === "error");

  return (
    <div className="relative group">
      <div
        className={cn(
          "size-5 rounded-full flex items-center justify-center text-xs font-bold",
          hasWarnings
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
        )}
      >
        {variances.length}
      </div>
      {/* Tooltip */}
      <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block">
        <div className="bg-popover border rounded-lg shadow-lg p-2 w-64 text-xs">
          <div className="font-medium mb-1 text-foreground">Review Notes</div>
          <div className="space-y-1">
            {variances.map((v, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-1",
                  v.type === "warning" && "text-amber-600 dark:text-amber-400",
                  v.type === "error" && "text-red-600 dark:text-red-400",
                  v.type === "info" && "text-blue-600 dark:text-blue-400"
                )}
              >
                <span className="shrink-0">
                  {v.type === "warning" || v.type === "error" ? "⚠" : "ℹ"}
                </span>
                <span>{v.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Calculate statutory payment due date (15th of following month)
 * Malaysian statutory contributions (EPF, SOCSO, EIS, PCB) are due by 15th of following month
 */
function getStatutoryDueDate(periodYear: number, periodMonth: number): Date {
  // Due date is 15th of the month following the payroll period
  const dueMonth = periodMonth === 12 ? 1 : periodMonth + 1;
  const dueYear = periodMonth === 12 ? periodYear + 1 : periodYear;
  return new Date(dueYear, dueMonth - 1, 15); // month is 0-indexed
}

/**
 * Get statutory payment status
 */
function getStatutoryPaymentStatus(periodYear: number, periodMonth: number): {
  dueDate: Date;
  dueDateString: string;
  daysUntilDue: number;
  isOverdue: boolean;
  isDueSoon: boolean; // within 5 days
} {
  const dueDate = getStatutoryDueDate(periodYear, periodMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    dueDate,
    dueDateString: dueDate.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }),
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
    isDueSoon: daysUntilDue >= 0 && daysUntilDue <= 5,
  };
}

/**
 * Statutory Due Date Banner Component
 * Shows warning about statutory payment deadlines
 */
function StatutoryDueDateBanner({
  periodYear,
  periodMonth,
  status,
}: {
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
}) {
  const paymentStatus = getStatutoryPaymentStatus(periodYear, periodMonth);

  // Don't show banner if already paid and not overdue
  if (status === "paid" && !paymentStatus.isOverdue) {
    return null;
  }

  const periodLabel = `${monthNames[periodMonth - 1]} ${periodYear}`;

  if (paymentStatus.isOverdue) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-xl border border-red-300 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 dark:border-red-800"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-900/40">
            <AlertTriangleIcon className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-red-800 dark:text-red-300">
              Statutory Payments Overdue!
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
              EPF, SOCSO, EIS, and PCB for <span className="font-medium">{periodLabel}</span> were due on{" "}
              <span className="font-bold">{paymentStatus.dueDateString}</span>.
              Late payments may incur penalties. Please submit to KWSP, PERKESO, EIS, and LHDN immediately.
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-red-600 dark:text-red-400">
              <span className="font-medium">{Math.abs(paymentStatus.daysUntilDue)} day(s) overdue</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (paymentStatus.isDueSoon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-800/20 dark:border-amber-800"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/40">
            <ClockIcon className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">
              Statutory Payment Due Soon
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              EPF, SOCSO, EIS, and PCB for <span className="font-medium">{periodLabel}</span> are due on{" "}
              <span className="font-bold">{paymentStatus.dueDateString}</span>.
              Remember to submit payments to KWSP, PERKESO, EIS, and LHDN before the deadline.
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-amber-600 dark:text-amber-400">
              <span className="font-medium">
                {paymentStatus.daysUntilDue === 0
                  ? "Due today!"
                  : `${paymentStatus.daysUntilDue} day(s) remaining`}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Not urgent - just show informational banner for finalized status
  if (status === "finalized") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-900/40">
            <CalendarIcon className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300">
              Statutory Payment Deadline
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
              EPF, SOCSO, EIS, and PCB for <span className="font-medium">{periodLabel}</span> must be submitted to the respective agencies by{" "}
              <span className="font-bold">{paymentStatus.dueDateString}</span>.
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-blue-600 dark:text-blue-400">
              <span>{paymentStatus.daysUntilDue} day(s) remaining</span>
              <span>•</span>
              <span>KWSP, PERKESO, EIS & LHDN</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}

// Status guidance messages - function to generate dynamic content
const getStatusGuidance = (activeEmployeeCount: number) => ({
  draft: {
    title: "Ready to Calculate",
    description: activeEmployeeCount > 0
      ? `You have ${activeEmployeeCount} active employee(s) ready for payroll. Click 'Calculate Payroll' to generate pay slips with base salary and statutory deductions (EPF, SOCSO, EIS, PCB).`
      : "No active employees found. Please add employees with 'Active' status and a base salary before calculating payroll.",
    nextAction: activeEmployeeCount > 0 ? "Calculate Payroll" : "",
  },
  calculating: {
    title: "Calculating...",
    description: "Please wait while we calculate pay slips for all employees. This may take a moment.",
    nextAction: "",
  },
  pending_review: {
    title: "Review & Approve",
    description: "Pay slips have been generated. Review the calculations below. If everything looks correct, click 'Approve' to proceed. You can also click on any pay slip to view details.",
    nextAction: "Approve",
  },
  approved: {
    title: "Ready to Finalize",
    description: "This payroll run is approved. Clicking 'Finalize & Post Journal' will create accounting entries in your general ledger. This action will record salary expenses and liabilities.",
    nextAction: "Finalize & Post Journal",
  },
  finalized: {
    title: "Ready for Payment",
    description: "Journal entries have been posted. When you've transferred salaries to employees' bank accounts, click 'Mark as Paid' to complete the payroll cycle.",
    nextAction: "Mark as Paid",
  },
  paid: {
    title: "Completed",
    description: "This payroll run is complete. All salaries have been processed and recorded. You can download individual pay slips for distribution to employees.",
    nextAction: "",
  },
  cancelled: {
    title: "Cancelled",
    description: "This payroll run has been cancelled. No further actions can be taken.",
    nextAction: "",
  },
});

const columnHelper = createColumnHelper<PaySlip>();
const columnConfigHelper = createColumnConfigHelper<PaySlip>();

// Pay slip column config for filtering
const paySlipColumnConfig = [
  columnConfigHelper
    .text()
    .id("employeeCode")
    .displayName("Code")
    .accessor((row) => row.employeeCode)
    .icon(CalendarPenIcon)
    .build(),
  columnConfigHelper
    .text()
    .id("employeeName")
    .displayName("Name")
    .accessor((row) => row.employeeName)
    .icon(CalendarPenIcon)
    .build(),
];

// Workflow steps definition
const workflowSteps = [
  { status: "draft", label: "Draft", description: "Create payroll run" },
  { status: "pending_review", label: "Calculated", description: "Review pay slips" },
  { status: "approved", label: "Approved", description: "Ready for finalization" },
  { status: "finalized", label: "Finalized", description: "Journal posted" },
  { status: "paid", label: "Paid", description: "Salaries disbursed" },
] as const;

// Get step index for current status
function getStepIndex(status: PayrollRunStatus): number {
  if (status === "cancelled") return -1;
  if (status === "calculating") return 0;
  const idx = workflowSteps.findIndex((s) => s.status === status);
  return idx >= 0 ? idx : 0;
}

export function PayrollRunDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payrollRun, isLoading: isLoadingRun } = usePayrollRun(id || "");
  const { data: paySlips, isLoading: isLoadingSlips } = usePaySlips(id || "");
  const { data: employeeStats } = useEmployeeStats();

  const calculateMutation = useCalculatePayroll();
  const approveMutation = useApprovePayrollRun();
  const finalizeMutation = useFinalizePayrollRun();
  const markPaidMutation = useMarkPayrollPaid();
  const cancelMutation = useCancelPayrollRun();

  const isLoading = isLoadingRun || isLoadingSlips;
  const isMutating =
    calculateMutation.isPending ||
    approveMutation.isPending ||
    finalizeMutation.isPending ||
    markPaidMutation.isPending ||
    cancelMutation.isPending;

  // Generate status guidance with active employee count
  const statusGuidance = getStatusGuidance(employeeStats?.active ?? 0);

  // Pay slip modal state
  const [selectedPaySlipId, setSelectedPaySlipId] = useState<string | null>(null);
  const [isPaySlipModalOpen, setIsPaySlipModalOpen] = useState(false);

  // Confirmation dialog state
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showMarkPaidConfirm, setShowMarkPaidConfirm] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);

  const handleViewPaySlip = useCallback((paySlipId: string) => {
    setSelectedPaySlipId(paySlipId);
    setIsPaySlipModalOpen(true);
  }, []);

  const handleClosePaySlipModal = useCallback(() => {
    setIsPaySlipModalOpen(false);
    setSelectedPaySlipId(null);
  }, []);

  const handleCalculate = async () => {
    if (!id) return;
    try {
      const result = await calculateMutation.mutateAsync({ payrollRunId: id });
      if (result.success) {
        toast.success(`Payroll calculated for ${result.totalEmployees} employee(s)`);
      } else {
        // Show specific error messages
        const errorMsg = result.errors?.length > 0
          ? result.errors.join(", ")
          : "No active employees found";
        toast.error(errorMsg);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to calculate payroll";
      toast.error(message);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveMutation.mutateAsync({ id });
      toast.success("Payroll run approved");
    } catch {
      toast.error("Failed to approve payroll run");
    }
  };

  const handleFinalizeConfirm = async () => {
    if (!id) return;
    try {
      await finalizeMutation.mutateAsync({ id });
      toast.success("Payroll run finalized and journal entry created");
      setShowFinalizeConfirm(false);
    } catch {
      toast.error("Failed to finalize payroll run");
    }
  };

  const handleMarkPaidConfirm = async () => {
    if (!id || !paymentDate) return;
    try {
      await markPaidMutation.mutateAsync({ id, paymentDate });
      toast.success("Payroll marked as paid");
      setShowMarkPaidConfirm(false);
    } catch {
      toast.error("Failed to mark payroll as paid");
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelMutation.mutateAsync({ id });
      toast.success("Payroll run cancelled");
    } catch {
      toast.error("Failed to cancel payroll run");
    }
  };

  const columns = useMemo(() => [
    columnHelper.accessor((row) => row.employeeCode, {
      id: "employeeCode",
      header: ({ column }) => <HeaderColumnButton column={column}>Code</HeaderColumnButton>,
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.employeeCode}</span>,
    }),
    columnHelper.accessor((row) => row.employeeName, {
      id: "employeeName",
      header: ({ column }) => <HeaderColumnButton column={column}>Name</HeaderColumnButton>,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.employeeName}</div>
          {row.original.position && (
            <div className="text-sm text-muted-foreground">{row.original.position}</div>
          )}
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.baseSalary, {
      id: "baseSalary",
      header: ({ column }) => <HeaderColumnButton column={column}>Base</HeaderColumnButton>,
      cell: ({ row }) => formatCurrency(parseFloat(row.original.baseSalary)),
    }),
    columnHelper.accessor((row) => row.grossSalary, {
      id: "grossSalary",
      header: ({ column }) => <HeaderColumnButton column={column}>Gross</HeaderColumnButton>,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.grossSalary ? formatCurrency(parseFloat(row.original.grossSalary)) : "-"}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.epfEmployee, {
      id: "epfEmployee",
      header: ({ column }) => <HeaderColumnButton column={column}>EPF</HeaderColumnButton>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.epfEmployee ? formatCurrency(parseFloat(row.original.epfEmployee)) : "-"}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.socsoEmployee, {
      id: "socsoEmployee",
      header: ({ column }) => <HeaderColumnButton column={column}>SOCSO</HeaderColumnButton>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.socsoEmployee ? formatCurrency(parseFloat(row.original.socsoEmployee)) : "-"}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.eisEmployee, {
      id: "eisEmployee",
      header: ({ column }) => <HeaderColumnButton column={column}>EIS</HeaderColumnButton>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.eisEmployee ? formatCurrency(parseFloat(row.original.eisEmployee)) : "-"}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.pcb, {
      id: "pcb",
      header: ({ column }) => <HeaderColumnButton column={column}>PCB</HeaderColumnButton>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.pcb ? formatCurrency(parseFloat(row.original.pcb)) : "-"}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.netSalary, {
      id: "netSalary",
      header: ({ column }) => <HeaderColumnButton column={column}>Net Pay</HeaderColumnButton>,
      cell: ({ row }) => (
        <span className="font-medium text-primary">
          {row.original.netSalary ? formatCurrency(parseFloat(row.original.netSalary)) : "-"}
        </span>
      ),
    }),
    columnHelper.display({
      id: "variance",
      header: () => <span className="sr-only">Review</span>,
      cell: ({ row }) => {
        const variances = detectPaySlipVariances(row.original);
        return <VarianceIndicator variances={variances} />;
      },
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewPaySlip(row.original.id)}>
          <Eye className="size-4" />
        </Button>
      ),
    }),
  ], [handleViewPaySlip]);

  if (!id) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Invalid payroll run ID</p>
          <Button variant="link" onClick={() => navigate("/payroll")}>
            Back to Payroll Runs
          </Button>
        </div>
      </PageContainer>
    );
  }

  const periodLabel = payrollRun
    ? `${monthNames[payrollRun.periodMonth - 1]} ${payrollRun.periodYear}`
    : "";

  // Determine available actions based on status
  const canCancel = payrollRun && !["cancelled", "paid"].includes(payrollRun.status);

  return (
    <PageContainer>
      <PageHeader
        icon={CalendarIcon}
        title={isLoading ? "Loading..." : `Payroll: ${periodLabel}`}
        description={
          isLoading
            ? "Loading payroll run details..."
            : payrollRun?.name || `Run ${payrollRun?.runNumber}`
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/payroll")}>
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
          </div>
        }
      />

      {/* Workflow Stepper */}
      {payrollRun && payrollRun.status !== "cancelled" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border bg-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Workflow Progress</h3>
            {payrollRun.payDate && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Pay Date:</span>
                <span className="font-medium">{new Date(payrollRun.payDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Stepper */}
          <div className="overflow-x-auto -mx-2 px-2 pb-2">
            <div className="flex items-center justify-between relative min-w-[320px]">
              {/* Progress line */}
              <div className="absolute left-0 right-0 top-4 h-0.5 bg-muted" />
              <div
                className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
                style={{ width: `${(getStepIndex(payrollRun.status) / (workflowSteps.length - 1)) * 100}%` }}
              />

              {workflowSteps.map((step, index) => {
                const currentIndex = getStepIndex(payrollRun.status);
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <div key={step.status} className="relative flex flex-col items-center z-10">
                    <div
                      className={cn(
                        "size-7 sm:size-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircleIcon className="size-3.5 sm:size-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] sm:text-xs font-medium mt-1.5 sm:mt-2 text-center whitespace-nowrap",
                        isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center hidden sm:block">
                      {step.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Cancelled Banner */}
      {payrollRun?.status === "cancelled" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20"
        >
          <div className="flex items-center gap-3">
            <XCircleIcon className="size-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">Payroll Run Cancelled</p>
              <p className="text-sm text-red-600 dark:text-red-400">This payroll run has been cancelled and cannot be processed.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status Guidance Card */}
      {payrollRun && payrollRun.status !== "cancelled" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn(
            "mb-6 p-4 rounded-xl border",
            payrollRun.status === "draft" && "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800",
            payrollRun.status === "pending_review" && "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800",
            payrollRun.status === "approved" && "bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-800",
            payrollRun.status === "finalized" && "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800",
            payrollRun.status === "paid" && "bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/20 dark:to-gray-900/20 border-slate-200 dark:border-slate-800"
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              "size-10 rounded-lg flex items-center justify-center shrink-0",
              payrollRun.status === "draft" && "bg-blue-100 dark:bg-blue-900/40",
              payrollRun.status === "pending_review" && "bg-amber-100 dark:bg-amber-900/40",
              payrollRun.status === "approved" && "bg-purple-100 dark:bg-purple-900/40",
              payrollRun.status === "finalized" && "bg-emerald-100 dark:bg-emerald-900/40",
              payrollRun.status === "paid" && "bg-slate-100 dark:bg-slate-800"
            )}>
              {payrollRun.status === "paid" ? (
                <CheckCircleIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <InfoIcon className={cn(
                  "size-5",
                  payrollRun.status === "draft" && "text-blue-600 dark:text-blue-400",
                  payrollRun.status === "pending_review" && "text-amber-600 dark:text-amber-400",
                  payrollRun.status === "approved" && "text-purple-600 dark:text-purple-400",
                  payrollRun.status === "finalized" && "text-emerald-600 dark:text-emerald-400"
                )} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold",
                payrollRun.status === "draft" && "text-blue-800 dark:text-blue-300",
                payrollRun.status === "pending_review" && "text-amber-800 dark:text-amber-300",
                payrollRun.status === "approved" && "text-purple-800 dark:text-purple-300",
                payrollRun.status === "finalized" && "text-emerald-800 dark:text-emerald-300",
                payrollRun.status === "paid" && "text-slate-800 dark:text-slate-300"
              )}>
                {statusGuidance[payrollRun.status]?.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {statusGuidance[payrollRun.status]?.description}
              </p>
            </div>
            {statusGuidance[payrollRun.status]?.nextAction && (
              <div className="shrink-0">
                <Button
                  size="lg"
                  disabled={isMutating}
                  onClick={() => {
                    if (payrollRun.status === "draft") handleCalculate();
                    else if (payrollRun.status === "pending_review") handleApprove();
                    else if (payrollRun.status === "approved") setShowFinalizeConfirm(true);
                    else if (payrollRun.status === "finalized") setShowMarkPaidConfirm(true);
                  }}
                  className={cn(
                    payrollRun.status === "finalized" && "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  {isMutating ? (
                    <Loader2Icon className="size-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRightIcon className="size-4 mr-2" />
                  )}
                  {statusGuidance[payrollRun.status]?.nextAction}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Secondary Actions (Cancel) */}
      {canCancel && (
        <div className="flex justify-end mb-6">
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20"
            onClick={handleCancel}
            disabled={isMutating}
          >
            {cancelMutation.isPending ? (
              <Loader2Icon className="size-4 mr-2 animate-spin" />
            ) : (
              <XCircleIcon className="size-4 mr-2" />
            )}
            Cancel Run
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      {payrollRun && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            icon={TrendingUpIcon}
            label="Gross Salary"
            value={payrollRun.totalGrossSalary ? formatCurrency(parseFloat(payrollRun.totalGrossSalary)) : "-"}
            subValue={`${payrollRun.totalEmployees ?? 0} employees`}
            description="Total before deductions"
            isLoading={isLoading}
          />
          <MetricCard
            icon={FileTextIcon}
            label="Statutory Deductions"
            value={
              payrollRun.totalEpfEmployee && payrollRun.totalSocsoEmployee && payrollRun.totalEisEmployee && payrollRun.totalPcb
                ? formatCurrency(
                    parseFloat(payrollRun.totalEpfEmployee) +
                    parseFloat(payrollRun.totalSocsoEmployee) +
                    parseFloat(payrollRun.totalEisEmployee || "0") +
                    parseFloat(payrollRun.totalPcb)
                  )
                : "-"
            }
            description="Employee contributions"
            details={[
              { label: "EPF", value: payrollRun.totalEpfEmployee ? formatCurrency(parseFloat(payrollRun.totalEpfEmployee)) : "-" },
              { label: "SOCSO", value: payrollRun.totalSocsoEmployee ? formatCurrency(parseFloat(payrollRun.totalSocsoEmployee)) : "-" },
              { label: "PCB", value: payrollRun.totalPcb ? formatCurrency(parseFloat(payrollRun.totalPcb)) : "-" },
            ]}
            isLoading={isLoading}
          />
          <MetricCard
            icon={BankIcon}
            label="Employer Cost"
            value={
              payrollRun.totalEpfEmployer && payrollRun.totalSocsoEmployer
                ? formatCurrency(
                    parseFloat(payrollRun.totalEpfEmployer) +
                    parseFloat(payrollRun.totalSocsoEmployer) +
                    parseFloat(payrollRun.totalEisEmployer || "0")
                  )
                : "-"
            }
            description="Employer contributions"
            details={[
              { label: "EPF", value: payrollRun.totalEpfEmployer ? formatCurrency(parseFloat(payrollRun.totalEpfEmployer)) : "-" },
              { label: "SOCSO", value: payrollRun.totalSocsoEmployer ? formatCurrency(parseFloat(payrollRun.totalSocsoEmployer)) : "-" },
              { label: "EIS", value: payrollRun.totalEisEmployer ? formatCurrency(parseFloat(payrollRun.totalEisEmployer)) : "-" },
            ]}
            isLoading={isLoading}
          />
          <MetricCard
            icon={CoinsIcon}
            label="Net Payable"
            value={payrollRun.totalNetSalary ? formatCurrency(parseFloat(payrollRun.totalNetSalary)) : "-"}
            description="Amount to disburse to employees"
            className="border-primary/20 bg-primary/5"
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Statutory Payment Due Date Warning */}
      {payrollRun && ["finalized", "paid"].includes(payrollRun.status) && (
        <StatutoryDueDateBanner
          periodYear={payrollRun.periodYear}
          periodMonth={payrollRun.periodMonth}
          status={payrollRun.status}
        />
      )}

      {/* Pay Slips Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Pay Slips</h2>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !paySlips?.length ? (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground">
              {payrollRun?.status === "draft"
                ? "Click 'Calculate Payroll' to generate pay slips for all active employees."
                : "No pay slips found for this payroll run."}
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={paySlips}
            columnConfig={paySlipColumnConfig}
            isLoading={false}
            defaultSorting={[{ id: "employeeCode", desc: false }]}
          />
        )}
      </div>

      {/* Pay Slip Detail Modal */}
      <PaySlipDetailModal
        isOpen={isPaySlipModalOpen}
        onClose={handleClosePaySlipModal}
        paySlipId={selectedPaySlipId}
        periodYear={payrollRun?.periodYear}
        periodMonth={payrollRun?.periodMonth}
      />

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize Payroll & Post Journal Entry</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This action will create the following accounting entries:</p>
              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                <li>Debit: Salaries & Wages (expense)</li>
                <li>Debit: EPF, SOCSO, EIS Employer contributions (expense)</li>
                <li>Credit: Accrued Salaries (liability)</li>
                <li>Credit: EPF, SOCSO, EIS, PCB Payable (liability)</li>
              </ul>
              <p className="mt-3 font-medium text-amber-600 dark:text-amber-400">
                This action cannot be undone. Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalizeConfirm}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending ? "Finalizing..." : "Finalize & Post Journal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Paid Confirmation Dialog */}
      <AlertDialog open={showMarkPaidConfirm} onOpenChange={setShowMarkPaidConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Payroll as Paid</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will record that salaries have been disbursed to employees.</p>
                <p>A payment journal entry will be created:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Debit: Accrued Salaries (clear liability)</li>
                  <li>Credit: Cash at Bank (payment)</li>
                </ul>

                {/* Payment Date Picker */}
                <div className="pt-2">
                  <Label htmlFor="payment-date" className="text-foreground font-medium">
                    Payment Date
                  </Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-1.5"
                    aria-describedby="payment-date-description"
                  />
                  <p id="payment-date-description" className="text-xs text-muted-foreground mt-1">
                    The date when salaries were transferred to employees
                  </p>
                </div>

                <p className="font-medium text-emerald-600 dark:text-emerald-400 pt-1">
                  Confirm that salaries have been transferred to employee bank accounts.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markPaidMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkPaidConfirm}
              disabled={markPaidMutation.isPending || !paymentDate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {markPaidMutation.isPending ? "Processing..." : "Mark as Paid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
