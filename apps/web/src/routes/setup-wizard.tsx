/**
 * Setup Wizard / Migration Page
 * Multi-step wizard for data migration and opening balance setup
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import {
  useGetOrCreateSession,
  useMigrationSession,
  useUpdateProgress,
  useOpeningBalances,
  useTrialBalanceSummary,
  useValidateSession,
  useApplyOpeningBalances,
} from "@/api/migration";
import type { MigrationSession, SourceSystem } from "@/api/migration";
import { OpeningBalanceImport, PayrollYtdImport, MigrationAssistant } from "@/components/migration";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircleIcon,
  Loader2Icon,
  Building2,
  CalendarIcon,
  FileTextIcon,
  UsersIcon,
  CoinsIcon,
  PlayIcon,
  AlertCircleIcon,
} from "@/components/ui/icons";

// Wizard steps definition
const wizardSteps = [
  { id: "welcome", label: "Welcome", description: "Choose source system" },
  { id: "date", label: "Dates", description: "Set conversion date" },
  { id: "balances", label: "Balances", description: "Opening trial balance" },
  { id: "subledger", label: "Subledger", description: "AR/AP detail" },
  { id: "payroll", label: "Payroll YTD", description: "Mid-year payroll" },
  { id: "review", label: "Review", description: "Validate & apply" },
] as const;

type StepId = (typeof wizardSteps)[number]["id"];

// Source system options
const sourceSystemOptions: Array<{ value: SourceSystem; label: string; description: string }> = [
  { value: "quickbooks", label: "QuickBooks", description: "Import from QuickBooks Online or Desktop" },
  { value: "xero", label: "Xero", description: "Import from Xero accounting" },
  { value: "sage", label: "Sage", description: "Import from Sage 50/200" },
  { value: "sql_accounting", label: "SQL Accounting", description: "Import from SQL Accounting (MY)" },
  { value: "autocount", label: "AutoCount", description: "Import from AutoCount Accounting" },
  { value: "wave", label: "Wave", description: "Import from Wave Accounting" },
  { value: "zoho", label: "Zoho Books", description: "Import from Zoho Books" },
  { value: "custom", label: "Other / Manual", description: "Start fresh or import from CSV" },
];

// Step indicator component
function StepIndicator({
  steps,
  currentStep,
  onStepClick
}: {
  steps: typeof wizardSteps;
  currentStep: StepId;
  onStepClick: (step: StepId) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="relative">
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isClickable = index <= currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "border-emerald-500 bg-emerald-500 text-white cursor-pointer",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  !isCompleted && !isCurrent && "border-muted-foreground/30 bg-background text-muted-foreground",
                  isClickable && "cursor-pointer hover:opacity-80"
                )}
              >
                {isCompleted ? (
                  <CheckCircleIcon className="size-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </button>
              <div className="mt-2 text-center hidden sm:block">
                <p className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground/70">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Progress line */}
      <div className="absolute top-5 left-0 right-0 -z-10 flex">
        <div className="flex-1" />
        {steps.slice(0, -1).map((_, index) => (
          <div
            key={index}
            className={cn(
              "flex-1 h-0.5 mx-2",
              index < currentIndex ? "bg-emerald-500" : "bg-muted-foreground/30"
            )}
          />
        ))}
        <div className="flex-1" />
      </div>
    </div>
  );
}

// Welcome step component
function WelcomeStep({
  selectedSystem,
  onSelect,
}: {
  selectedSystem: SourceSystem | null;
  onSelect: (system: SourceSystem) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Welcome to Open Bookkeeping</h2>
        <p className="text-muted-foreground">
          Let's set up your accounting data. Where are you migrating from?
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sourceSystemOptions.map((option) => (
          <motion.button
            key={option.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all",
              selectedSystem === option.value
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-3 w-full">
              <Building2 className="size-5 text-muted-foreground" />
              <span className="font-medium">{option.label}</span>
              {selectedSystem === option.value && (
                <CheckCircleIcon className="size-4 text-primary ml-auto" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{option.description}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Date step component
function DateStep({
  conversionDate,
  financialYearStart,
  onDateChange,
  onYearStartChange,
}: {
  conversionDate: string;
  financialYearStart: string;
  onDateChange: (date: string) => void;
  onYearStartChange: (date: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Set Key Dates</h2>
        <p className="text-muted-foreground">
          These dates help us set up your opening balances correctly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5" />
            Conversion Date
          </CardTitle>
          <CardDescription>
            The date when you're switching to Open Bookkeeping.
            Opening balances will be as of this date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="date"
            value={conversionDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="size-5" />
            Financial Year Start
          </CardTitle>
          <CardDescription>
            When does your financial year begin? (Usually January 1 or April 1)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="date"
            value={financialYearStart}
            onChange={(e) => onYearStartChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Opening Balances step
function BalancesStep({
  sessionId,
  showImport,
  onShowImport,
}: {
  sessionId: string;
  showImport: boolean;
  onShowImport: (show: boolean) => void;
}) {
  const { data: balances, isLoading, refetch } = useOpeningBalances(sessionId);
  const { data: summary, refetch: refetchSummary } = useTrialBalanceSummary(sessionId);

  const handleImportSuccess = () => {
    void refetch();
    void refetchSummary();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Opening Balances</h2>
          <p className="text-muted-foreground">
            Enter your trial balance as of the conversion date.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CoinsIcon className="size-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Debits</p>
                  <p className="text-xl font-bold">{formatCurrency(parseFloat(summary?.totalDebits ?? "0"))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10">
                  <CoinsIcon className="size-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Credits</p>
                  <p className="text-xl font-bold">{formatCurrency(parseFloat(summary?.totalCredits ?? "0"))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "bg-gradient-to-br",
            summary?.isBalanced
              ? "from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10"
              : "from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex size-10 items-center justify-center rounded-lg",
                  summary?.isBalanced ? "bg-emerald-500/10" : "bg-amber-500/10"
                )}>
                  {summary?.isBalanced ? (
                    <CheckCircleIcon className="size-5 text-emerald-600" />
                  ) : (
                    <AlertCircleIcon className="size-5 text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="text-xl font-bold">
                    {summary?.isBalanced ? "Balanced" : `Off by ${formatCurrency(Math.abs(parseFloat(summary?.difference ?? "0")))}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Balances list */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Trial Balance Entries</CardTitle>
              <Button variant="outline" size="sm" onClick={() => onShowImport(true)}>
                <FileTextIcon className="size-4 mr-2" />
                Import CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {balances && balances.length > 0 ? (
              <div className="space-y-2">
                {balances.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{entry.accountCode} - {entry.accountName}</p>
                      <p className="text-sm text-muted-foreground">{entry.accountType}</p>
                    </div>
                    <div className="text-right">
                      {parseFloat(entry.debitAmount) > 0 && (
                        <p className="text-emerald-600">{formatCurrency(parseFloat(entry.debitAmount))} DR</p>
                      )}
                      {parseFloat(entry.creditAmount) > 0 && (
                        <p className="text-rose-600">{formatCurrency(parseFloat(entry.creditAmount))} CR</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CoinsIcon className="size-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No opening balances yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Import from your previous system or add entries manually.
                </p>
                <Button onClick={() => onShowImport(true)}>Import CSV</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OpeningBalanceImport
        open={showImport}
        onOpenChange={onShowImport}
        sessionId={sessionId}
        onSuccess={handleImportSuccess}
      />
    </>
  );
}

// Subledger step placeholder
function SubledgerStep() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Subledger Detail</h2>
        <p className="text-muted-foreground">
          Optionally add AR/AP detail for accounts receivable and payable.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5" />
              Accounts Receivable
            </CardTitle>
            <CardDescription>
              Outstanding customer invoices as of conversion date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Add Customer Balances
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5" />
              Accounts Payable
            </CardTitle>
            <CardDescription>
              Outstanding vendor bills as of conversion date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Add Vendor Balances
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        This step is optional. You can skip it and add detail later.
      </p>
    </div>
  );
}

// Payroll YTD step
function PayrollYtdStep({
  sessionId,
  showImport,
  onShowImport,
}: {
  sessionId: string;
  showImport: boolean;
  onShowImport: (show: boolean) => void;
}) {
  return (
    <>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Payroll Year-to-Date</h2>
          <p className="text-muted-foreground">
            If migrating mid-year, enter YTD payroll figures for accurate statutory calculations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5" />
              Employee YTD Balances
            </CardTitle>
            <CardDescription>
              Import or enter YTD gross pay, EPF, SOCSO, EIS, and PCB for each employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <UsersIcon className="size-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No employees with YTD data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add employee YTD data for accurate statutory calculations.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onShowImport(true)}>
                  Import CSV
                </Button>
                <Button>Add Manually</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          This step is optional if you're starting at the beginning of the year.
        </p>
      </div>

      <PayrollYtdImport
        open={showImport}
        onOpenChange={onShowImport}
        sessionId={sessionId}
      />
    </>
  );
}

// Review step
function ReviewStep({
  session,
  onValidate,
  onApply,
  isValidating,
  isApplying
}: {
  session: MigrationSession;
  onValidate: () => void;
  onApply: () => void;
  isValidating: boolean;
  isApplying: boolean;
}) {
  const validationResults = session.validationResults;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Review & Apply</h2>
        <p className="text-muted-foreground">
          Review your migration setup before applying.
        </p>
      </div>

      {/* Validation status */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Status</CardTitle>
          <CardDescription>
            Run validation to check for errors before applying
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {validationResults ? (
            <div className="space-y-3">
              {validationResults.details.map((check, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    check.status === "pass" && "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
                    check.status === "warning" && "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
                    check.status === "error" && "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20"
                  )}
                >
                  {check.status === "pass" && <CheckCircleIcon className="size-5 text-emerald-600" />}
                  {check.status === "warning" && <AlertCircleIcon className="size-5 text-amber-600" />}
                  {check.status === "error" && <AlertCircleIcon className="size-5 text-rose-600" />}
                  <div className="flex-1">
                    <p className="font-medium">{check.check}</p>
                    <p className="text-sm text-muted-foreground">{check.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Click "Validate" to check your migration setup.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={onValidate}
              disabled={isValidating}
              variant="outline"
              className="flex-1"
            >
              {isValidating ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="size-4 mr-2" />
                  Validate
                </>
              )}
            </Button>

            <Button
              onClick={onApply}
              disabled={isApplying || !validationResults || validationResults.errors > 0}
              className="flex-1"
            >
              {isApplying ? (
                <>
                  <Loader2Icon className="size-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <PlayIcon className="size-4 mr-2" />
                  Apply Migration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState<StepId>("welcome");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sourceSystem, setSourceSystem] = useState<SourceSystem | null>(null);
  const [conversionDate, setConversionDate] = useState(
    new Date().toISOString().split("T")[0] ?? ""
  );
  const [financialYearStart, setFinancialYearStart] = useState(
    `${new Date().getFullYear()}-01-01`
  );

  // Import dialog states
  const [showBalanceImport, setShowBalanceImport] = useState(false);
  const [showPayrollYtdImport, setShowPayrollYtdImport] = useState(false);

  const getOrCreateSession = useGetOrCreateSession();
  const { data: session } = useMigrationSession(sessionId ?? "");
  const updateProgress = useUpdateProgress();
  const validateSession = useValidateSession();
  const applyBalances = useApplyOpeningBalances();

  const currentStepIndex = useMemo(
    () => wizardSteps.findIndex((s) => s.id === currentStep),
    [currentStep]
  );

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case "welcome":
        return !!sourceSystem;
      case "date":
        return !!conversionDate;
      default:
        return true;
    }
  }, [currentStep, sourceSystem, conversionDate]);

  const handleNext = async () => {
    if (currentStep === "welcome" && sourceSystem) {
      // Create session when moving from welcome
      try {
        const result = await getOrCreateSession.mutateAsync({
          sourceSystem,
          conversionDate,
          financialYearStart,
        });
        setSessionId(result.id);
      } catch {
        toast.error("Failed to create migration session");
        return;
      }
    }

    if (currentStepIndex < wizardSteps.length - 1) {
      const nextStepData = wizardSteps[currentStepIndex + 1];
      if (!nextStepData) return;
      const nextStep = nextStepData.id;
      setCurrentStep(nextStep);

      // Update progress in database
      if (sessionId) {
        const completedSteps = wizardSteps
          .slice(0, currentStepIndex + 1)
          .map((s) => s.id);
        updateProgress.mutate({
          sessionId,
          currentStep: nextStep,
          completedSteps,
        });
      }
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const prevStepData = wizardSteps[currentStepIndex - 1];
      if (prevStepData) {
        setCurrentStep(prevStepData.id);
      }
    }
  };

  const handleStepClick = (stepId: StepId) => {
    const stepIndex = wizardSteps.findIndex((s) => s.id === stepId);
    if (stepIndex <= currentStepIndex) {
      setCurrentStep(stepId);
    }
  };

  const handleValidate = async () => {
    if (!sessionId) return;
    try {
      await validateSession.mutateAsync({ sessionId });
      toast.success("Validation complete");
    } catch {
      toast.error("Validation failed");
    }
  };

  const handleApply = async () => {
    if (!sessionId) return;
    try {
      await applyBalances.mutateAsync({ sessionId });
      toast.success("Migration applied successfully!");
    } catch {
      toast.error("Failed to apply migration");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Setup Wizard"
        description="Set up your accounting data and opening balances"
      />

      <div className="space-y-8">
        {/* Step indicator */}
        <StepIndicator
          steps={wizardSteps}
          currentStep={currentStep}
          onStepClick={handleStepClick}
        />

        {/* Step content */}
        <Card className="min-h-[400px]">
          <CardContent className="pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentStep === "welcome" && (
                  <WelcomeStep
                    selectedSystem={sourceSystem}
                    onSelect={setSourceSystem}
                  />
                )}
                {currentStep === "date" && (
                  <DateStep
                    conversionDate={conversionDate}
                    financialYearStart={financialYearStart}
                    onDateChange={setConversionDate}
                    onYearStartChange={setFinancialYearStart}
                  />
                )}
                {currentStep === "balances" && sessionId && (
                  <BalancesStep
                    sessionId={sessionId}
                    showImport={showBalanceImport}
                    onShowImport={setShowBalanceImport}
                  />
                )}
                {currentStep === "subledger" && <SubledgerStep />}
                {currentStep === "payroll" && sessionId && (
                  <PayrollYtdStep
                    sessionId={sessionId}
                    showImport={showPayrollYtdImport}
                    onShowImport={setShowPayrollYtdImport}
                  />
                )}
                {currentStep === "review" && session && (
                  <ReviewStep
                    session={session}
                    onValidate={handleValidate}
                    onApply={handleApply}
                    isValidating={validateSession.isPending}
                    isApplying={applyBalances.isPending}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>

          {currentStep !== "review" && (
            <Button onClick={handleNext} disabled={!canGoNext}>
              Next
              <ArrowRight className="size-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* AI Migration Assistant - floating chat */}
      {sessionId && (
        <MigrationAssistant
          sessionId={sessionId}
          currentStep={currentStep}
        />
      )}
    </PageContainer>
  );
}
