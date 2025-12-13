/**
 * Payroll Runs Page
 * List, create, and manage payroll runs with clear onboarding
 */

import { useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { useAuth } from "@/providers/auth-provider";
import {
  usePayrollRuns,
  useCalculatePayroll,
  useApprovePayrollRun,
  useCancelPayrollRun,
  useEmployees,
} from "@/api/payroll";
import type { PayrollRun, PayrollRunStatus } from "@/api/payroll";
import {
  Plus,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  CoinsIcon,
  BankIcon,
  UsersIcon,
  ArrowRightIcon,
  SparklesIcon,
  AlertCircleIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { PayrollRunFormModal } from "@/components/payroll/payroll-run-form-modal";
import { DeletePayrollRunModal } from "@/components/payroll/delete-payroll-run-modal";
import { createPayrollRunColumns, payrollRunColumnConfig } from "@/components/table-columns/payroll-runs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { MetricCard } from "@/components/dashboard";

const currentYear = new Date().getFullYear();

// Workflow steps for onboarding
const WORKFLOW_STEPS = [
  {
    step: 1,
    title: "Add Employees",
    description: "Add your team members with their salary details",
    icon: UsersIcon,
    link: "/employees",
    linkText: "Manage Employees",
  },
  {
    step: 2,
    title: "Create Payroll Run",
    description: "Start a new payroll for a specific month/year",
    icon: CalendarIcon,
    action: "create",
    linkText: "New Payroll Run",
  },
  {
    step: 3,
    title: "Calculate & Review",
    description: "System calculates EPF, SOCSO, EIS, PCB automatically",
    icon: SparklesIcon,
  },
  {
    step: 4,
    title: "Approve & Finalize",
    description: "Review pay slips and post journal entries",
    icon: CheckCircleIcon,
  },
];

export function PayrollRuns() {
  const { isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<PayrollRunStatus | "all">("all");
  const [yearFilter, setYearFilter] = useState<number | undefined>(currentYear);

  const { data: payrollRuns, isLoading } = usePayrollRuns({
    status: statusFilter === "all" ? undefined : statusFilter,
    year: yearFilter,
  });

  const { data: employees, isLoading: isLoadingEmployees } = useEmployees({ status: "active" });
  const activeEmployeeCount = employees?.length ?? 0;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);

  const calculateMutation = useCalculatePayroll();
  const approveMutation = useApprovePayrollRun();
  const cancelMutation = useCancelPayrollRun();

  const showSkeleton = isLoading || isAuthLoading || isLoadingEmployees;

  const handleView = useCallback((run: PayrollRun) => {
    navigate(`/payroll/${run.id}`);
  }, [navigate]);

  const handleEdit = useCallback((run: PayrollRun) => {
    setSelectedRun(run);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((run: PayrollRun) => {
    setSelectedRun(run);
    setIsDeleteOpen(true);
  }, []);

  const handleCalculate = useCallback(async (run: PayrollRun) => {
    try {
      await calculateMutation.mutateAsync({ payrollRunId: run.id });
      toast.success("Payroll calculated successfully");
    } catch {
      toast.error("Failed to calculate payroll");
    }
  }, [calculateMutation]);

  const handleApprove = useCallback(async (run: PayrollRun) => {
    try {
      await approveMutation.mutateAsync({ id: run.id });
      toast.success("Payroll run approved");
    } catch {
      toast.error("Failed to approve payroll run");
    }
  }, [approveMutation]);

  const handleCancel = useCallback(async (run: PayrollRun) => {
    try {
      await cancelMutation.mutateAsync({ id: run.id });
      toast.success("Payroll run cancelled");
    } catch {
      toast.error("Failed to cancel payroll run");
    }
  }, [cancelMutation]);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setSelectedRun(null);
  }, []);

  const handleDeleteClose = useCallback(() => {
    setIsDeleteOpen(false);
    setSelectedRun(null);
  }, []);

  const columns = useMemo(
    () =>
      createPayrollRunColumns({
        onView: handleView,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onCalculate: handleCalculate,
        onApprove: handleApprove,
        onCancel: handleCancel,
      }),
    [handleView, handleEdit, handleDelete, handleCalculate, handleApprove, handleCancel]
  );

  // Calculate meaningful financial analytics from payroll runs
  const analytics = useMemo(() => {
    if (!payrollRuns || payrollRuns.length === 0) return null;

    // Get current year runs for YTD calculations
    const currentYear = new Date().getFullYear();
    const ytdRuns = payrollRuns.filter(r =>
      r.periodYear === currentYear &&
      ["finalized", "paid"].includes(r.status)
    );

    // Calculate YTD totals
    const ytdNet = ytdRuns.reduce((sum, r) =>
      sum + (r.totalNetSalary ? parseFloat(r.totalNetSalary) : 0), 0
    );
    const ytdEmployees = ytdRuns.reduce((sum, r) => sum + (r.totalEmployees ?? 0), 0);

    // Calculate total statutory contributions (employer + employee)
    const ytdStatutory = ytdRuns.reduce((sum, r) => {
      const epf = (r.totalEpfEmployer ? parseFloat(r.totalEpfEmployer) : 0) +
                  (r.totalEpfEmployee ? parseFloat(r.totalEpfEmployee) : 0);
      const socso = (r.totalSocsoEmployer ? parseFloat(r.totalSocsoEmployer) : 0) +
                    (r.totalSocsoEmployee ? parseFloat(r.totalSocsoEmployee) : 0);
      const eis = (r.totalEisEmployer ? parseFloat(r.totalEisEmployer) : 0) +
                  (r.totalEisEmployee ? parseFloat(r.totalEisEmployee) : 0);
      const pcb = r.totalPcb ? parseFloat(r.totalPcb) : 0;
      return sum + epf + socso + eis + pcb;
    }, 0);

    // Pending payment (finalized but not paid)
    const pendingPayment = payrollRuns
      .filter(r => r.status === "finalized")
      .reduce((sum, r) => sum + (r.totalNetSalary ? parseFloat(r.totalNetSalary) : 0), 0);

    // Total payroll cost (gross + employer contributions)
    const ytdTotalCost = ytdRuns.reduce((sum, r) => {
      const gross = r.totalGrossSalary ? parseFloat(r.totalGrossSalary) : 0;
      const epfEr = r.totalEpfEmployer ? parseFloat(r.totalEpfEmployer) : 0;
      const socsoEr = r.totalSocsoEmployer ? parseFloat(r.totalSocsoEmployer) : 0;
      const eisEr = r.totalEisEmployer ? parseFloat(r.totalEisEmployer) : 0;
      return sum + gross + epfEr + socsoEr + eisEr;
    }, 0);

    // Average per employee (if we have data)
    const avgPerEmployee = ytdEmployees > 0 ? ytdNet / ytdEmployees : 0;

    return {
      ytdTotalCost,
      ytdNet,
      ytdStatutory,
      pendingPayment,
      avgPerEmployee,
      runsThisYear: ytdRuns.length,
    };
  }, [payrollRuns]);

  // Show onboarding if no employees or no payroll runs
  const showOnboarding = !showSkeleton && (activeEmployeeCount === 0 || !payrollRuns?.length);

  return (
    <PageContainer>
      <PageHeader
        icon={CalendarIcon}
        title="Payroll"
        description="Process salaries with automatic Malaysian statutory calculations"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-36" />
          ) : (
            <Button onClick={() => setIsFormOpen(true)} disabled={activeEmployeeCount === 0}>
              <Plus className="size-4 mr-2" />
              New Payroll Run
            </Button>
          )
        }
      />

      {/* No Employees Warning */}
      {!showSkeleton && activeEmployeeCount === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20"
        >
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">No employees found</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Add at least one employee before creating a payroll run.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to="/employees">
                Add Employees
                <ChevronRightIcon className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Onboarding Section */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-8"
          >
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
              <div className="flex items-center gap-2 mb-4">
                <SparklesIcon className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">How Payroll Works</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {WORKFLOW_STEPS.map((step, index) => (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "relative rounded-lg border bg-card p-4 transition-all",
                      step.link || step.action ? "hover:border-primary/50 hover:shadow-md cursor-pointer" : ""
                    )}
                    onClick={() => {
                      if (step.link) navigate(step.link);
                      if (step.action === "create" && activeEmployeeCount > 0) setIsFormOpen(true);
                    }}
                  >
                    {/* Step number badge */}
                    <div className="absolute -top-2.5 -left-2.5 size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {step.step}
                    </div>

                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "rounded-lg p-2 shrink-0",
                        index === 0 && activeEmployeeCount === 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"
                      )}>
                        <step.icon className={cn(
                          "size-4",
                          index === 0 && activeEmployeeCount === 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm">{step.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                        {step.linkText && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-primary font-medium">
                            {step.linkText}
                            <ArrowRightIcon className="size-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Quick info cards */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">EPF (KWSP)</p>
                  <p className="text-sm mt-0.5">Employee 11% / Employer 12-13%</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">SOCSO (PERKESO)</p>
                  <p className="text-sm mt-0.5">Employee 0.5% / Employer 1.75%</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">EIS</p>
                  <p className="text-sm mt-0.5">Employee 0.2% / Employer 0.2%</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Financial Analytics - Only show when there are payroll runs */}
      {payrollRuns && payrollRuns.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <MetricCard
            icon={CoinsIcon}
            label="YTD Payroll Cost"
            value={analytics ? formatCurrency(analytics.ytdTotalCost) : "-"}
            subValue="total cost"
            description="Gross salaries + employer contributions"
            details={[
              { label: "Net Salaries", value: analytics ? formatCurrency(analytics.ytdNet) : "-" },
              { label: "Statutory", value: analytics ? formatCurrency(analytics.ytdStatutory) : "-" },
            ]}
            isLoading={showSkeleton}
          />
          <MetricCard
            icon={BankIcon}
            label="Net Disbursed"
            value={analytics ? formatCurrency(analytics.ytdNet) : "-"}
            description="Total paid to employees this year"
            subValue={`${analytics?.runsThisYear ?? 0} runs`}
            isLoading={showSkeleton}
          />
          <MetricCard
            icon={ClockIcon}
            label="Pending Payment"
            value={analytics ? formatCurrency(analytics.pendingPayment) : "-"}
            description="Finalized runs awaiting disbursement"
            isLoading={showSkeleton}
          />
          <MetricCard
            icon={UsersIcon}
            label="Avg. Per Employee"
            value={analytics ? formatCurrency(analytics.avgPerEmployee) : "-"}
            description="Average net salary per employee"
            details={[
              { label: "Total Runs", value: payrollRuns.length },
              { label: "Completed", value: payrollRuns.filter(r => r.status === "paid").length },
            ]}
            isLoading={showSkeleton}
          />
        </div>
      )}

      {/* Filters - Only show when there are payroll runs */}
      {payrollRuns && payrollRuns.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Year:</span>
            <Select
              value={yearFilter ? String(yearFilter) : "all"}
              onValueChange={(v) => setYearFilter(v === "all" ? undefined : parseInt(v))}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter Tabs */}
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PayrollRunStatus | "all")}
          >
            <div className="overflow-x-auto -mx-1 px-1 pb-2">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="pending_review">Pending</TabsTrigger>
                <TabsTrigger value="approved">
                  <span className="hidden sm:inline">Approved</span>
                  <span className="sm:hidden">Appr</span>
                </TabsTrigger>
                <TabsTrigger value="finalized">
                  <span className="hidden sm:inline">Finalized</span>
                  <span className="sm:hidden">Final</span>
                </TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>
      )}

      {showSkeleton ? (
        <DataTable
          columns={columns}
          data={[]}
          columnConfig={payrollRunColumnConfig}
          isLoading={true}
          defaultSorting={[{ id: "runNumber", desc: true }]}
        />
      ) : !payrollRuns?.length ? (
        activeEmployeeCount > 0 ? (
          <EmptyState
            icon={CalendarIcon}
            title="No payroll runs yet"
            description="Create your first payroll run to start processing employee salaries."
            action={
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="size-4 mr-2" />
                New Payroll Run
              </Button>
            }
          />
        ) : null
      ) : (
        <DataTable
          columns={columns}
          data={payrollRuns}
          columnConfig={payrollRunColumnConfig}
          isLoading={false}
          defaultSorting={[{ id: "runNumber", desc: true }]}
        />
      )}

      <PayrollRunFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        payrollRun={selectedRun}
      />
      <DeletePayrollRunModal
        isOpen={isDeleteOpen}
        onClose={handleDeleteClose}
        payrollRun={selectedRun}
      />
    </PageContainer>
  );
}
