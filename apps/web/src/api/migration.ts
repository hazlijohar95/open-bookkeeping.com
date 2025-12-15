/**
 * Migration & Opening Balance API hooks
 * React Query hooks for data migration operations using tRPC
 */

import { trpc } from "@/trpc/provider";

// ============================================================================
// Types
// ============================================================================

export type MigrationSessionStatus = "draft" | "in_progress" | "validating" | "validated" | "completed" | "failed";
export type SourceSystem = "quickbooks" | "xero" | "sage" | "wave" | "zoho" | "sql_accounting" | "autocount" | "custom";
export type ImportType =
  | "chart_of_accounts"
  | "opening_balances"
  | "customers"
  | "vendors"
  | "open_invoices"
  | "open_bills"
  | "bank_transactions"
  | "employees"
  | "payroll_ytd";
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type ValidationStatus = "pending" | "accepted" | "rejected" | "manual";

export interface MigrationSession {
  id: string;
  userId: string;
  name: string | null;
  status: MigrationSessionStatus;
  sourceSystem: SourceSystem | null;
  conversionDate: string | null;
  financialYearStart: string | null;
  currentStep: string | null;
  completedSteps: string[] | null;
  totalSteps: number | null;
  validationStatus: string | null;
  validationResults: ValidationResults | null;
  totalDebits: string | null;
  totalCredits: string | null;
  isBalanced: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResults {
  totalChecks: number;
  passed: number;
  warnings: number;
  errors: number;
  details: ValidationCheck[];
}

export interface ValidationCheck {
  check: string;
  status: "pass" | "warning" | "error";
  message: string;
  action?: string;
}

export interface OpeningBalanceEntry {
  id: string;
  migrationSessionId: string | null;
  userId: string;
  accountId: string | null;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitAmount: string;
  creditAmount: string;
  hasSubledgerDetail: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface OpeningBalanceSubledger {
  id: string;
  openingBalanceEntryId: string;
  userId: string;
  entityType: "customer" | "vendor";
  entityId: string | null;
  entityName: string;
  referenceNumber: string;
  documentDate: string | null;
  dueDate: string | null;
  originalAmount: string;
  outstandingAmount: string;
  currency: string;
  description: string | null;
  createdAt: Date;
}

export interface ImportTemplate {
  id: string;
  userId: string;
  name: string;
  importType: ImportType;
  sourceSystem: SourceSystem | null;
  columnMapping: ColumnMapping[];
  hasHeaderRow: boolean;
  delimiter: string;
  dateFormat: string;
  decimalSeparator: string;
  usageCount: number;
  createdAt: Date;
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
  defaultValue?: string;
  required: boolean;
}

export interface AccountMappingSuggestion {
  id: string;
  migrationSessionId: string;
  userId: string;
  sourceCode: string;
  sourceName: string;
  sourceType: string | null;
  targetAccountId: string | null;
  targetAccountCode: string | null;
  targetAccountName: string | null;
  confidence: string;
  reasoning: string | null;
  status: ValidationStatus;
  userSelectedAccountId: string | null;
  createdAt: Date;
}

export interface PayrollYtdMigration {
  id: string;
  migrationSessionId: string | null;
  userId: string;
  employeeId: string;
  asOfDate: string;
  monthsWorked: number;
  ytdGrossSalary: string;
  ytdBaseSalary: string;
  ytdAllowances: string;
  ytdOtherEarnings: string;
  ytdTotalDeductions: string;
  ytdOtherDeductions: string;
  ytdEpfEmployee: string;
  ytdSocsoEmployee: string;
  ytdEisEmployee: string;
  ytdPcb: string;
  ytdEpfEmployer: string;
  ytdSocsoEmployer: string;
  ytdEisEmployer: string;
  ytdNetSalary: string;
  notes: string | null;
  createdAt: Date;
}

export interface TrialBalanceSummary {
  totalDebits: string;
  totalCredits: string;
  isBalanced: boolean;
  difference: string;
  validation: {
    totalEntries: number;
    entriesWithAccounts: number;
    entriesWithoutAccounts: number;
  };
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateSessionInput {
  name?: string;
  sourceSystem?: SourceSystem;
  conversionDate?: string;
  financialYearStart?: string;
}

export interface UpdateSessionInput {
  id: string;
  name?: string;
  sourceSystem?: SourceSystem;
  conversionDate?: string;
  financialYearStart?: string;
  currentStep?: string;
  completedSteps?: string[];
}

export interface OpeningBalanceInput {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitAmount?: string;
  creditAmount?: string;
  accountId?: string;
}

export interface SubledgerItemInput {
  entityType: "customer" | "vendor";
  entityName: string;
  referenceNumber: string;
  documentDate?: string;
  dueDate?: string;
  originalAmount: string;
  outstandingAmount: string;
  currency?: string;
  description?: string;
  entityId?: string;
}

export interface PayrollYtdInput {
  sessionId: string;
  employeeId: string;
  asOfDate: string;
  monthsWorked: number;
  ytdGrossSalary: string;
  ytdBaseSalary: string;
  ytdAllowances?: string;
  ytdOtherEarnings?: string;
  ytdTotalDeductions?: string;
  ytdOtherDeductions?: string;
  ytdEpfEmployee: string;
  ytdSocsoEmployee: string;
  ytdEisEmployee: string;
  ytdPcb: string;
  ytdEpfEmployer: string;
  ytdSocsoEmployer: string;
  ytdEisEmployer: string;
  ytdNetSalary: string;
}

export interface DemoDataOptions {
  customers?: number;
  vendors?: number;
  invoices?: number;
  bills?: number;
  bankTransactions?: number;
  employees?: number;
  dateRange?: "1month" | "3months" | "6months" | "1year";
}

// ============================================================================
// Session Hooks
// ============================================================================

export function useGetOrCreateSession() {
  const utils = trpc.useUtils();
  return trpc.migration.getOrCreateSession.useMutation({
    onSuccess: () => {
      void utils.migration.listSessions.invalidate();
    },
  });
}

export function useMigrationSession(id: string) {
  return trpc.migration.getSession.useQuery(
    { id },
    { enabled: !!id }
  );
}

export function useMigrationSessions() {
  return trpc.migration.listSessions.useQuery();
}

export function useUpdateSession() {
  const utils = trpc.useUtils();
  return trpc.migration.updateSession.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getSession.invalidate({ id: variables.id });
      void utils.migration.listSessions.invalidate();
    },
  });
}

export function useUpdateProgress() {
  const utils = trpc.useUtils();
  return trpc.migration.updateProgress.useMutation({
    onSuccess: (data) => {
      if (data?.id) {
        void utils.migration.getSession.invalidate({ id: data.id });
      }
    },
  });
}

export function useCompleteSession() {
  const utils = trpc.useUtils();
  return trpc.migration.completeSession.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getSession.invalidate({ id: variables.id });
      void utils.migration.listSessions.invalidate();
    },
  });
}

export function useDeleteSession() {
  const utils = trpc.useUtils();
  return trpc.migration.deleteSession.useMutation({
    onSuccess: () => {
      void utils.migration.listSessions.invalidate();
    },
  });
}

// ============================================================================
// Opening Balance Hooks
// ============================================================================

export function useOpeningBalances(sessionId: string) {
  return trpc.migration.getOpeningBalances.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
}

export function useAddOpeningBalance() {
  const utils = trpc.useUtils();
  return trpc.migration.addOpeningBalance.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getOpeningBalances.invalidate({ sessionId: variables.sessionId });
      void utils.migration.getTrialBalanceSummary.invalidate({ sessionId: variables.sessionId });
    },
  });
}

export function useBulkAddOpeningBalances() {
  const utils = trpc.useUtils();
  return trpc.migration.bulkAddOpeningBalances.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getOpeningBalances.invalidate({ sessionId: variables.sessionId });
      void utils.migration.getTrialBalanceSummary.invalidate({ sessionId: variables.sessionId });
    },
  });
}

export function useUpdateOpeningBalance() {
  const utils = trpc.useUtils();
  return trpc.migration.updateOpeningBalance.useMutation({
    onSuccess: () => {
      void utils.migration.getOpeningBalances.invalidate();
      void utils.migration.getTrialBalanceSummary.invalidate();
    },
  });
}

export function useDeleteOpeningBalance() {
  const utils = trpc.useUtils();
  return trpc.migration.deleteOpeningBalance.useMutation({
    onSuccess: () => {
      void utils.migration.getOpeningBalances.invalidate();
      void utils.migration.getTrialBalanceSummary.invalidate();
    },
  });
}

export function useTrialBalanceSummary(sessionId: string) {
  return trpc.migration.getTrialBalanceSummary.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
}

// ============================================================================
// Subledger Hooks
// ============================================================================

export function useSubledgerItems(entryId: string) {
  return trpc.migration.getSubledgerItems.useQuery(
    { entryId },
    { enabled: !!entryId }
  );
}

export function useAddSubledgerItems() {
  const utils = trpc.useUtils();
  return trpc.migration.addSubledgerItems.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getSubledgerItems.invalidate({ entryId: variables.entryId });
    },
  });
}

// ============================================================================
// Import Template Hooks
// ============================================================================

export function useImportTemplates(importType?: ImportType) {
  return trpc.migration.listTemplates.useQuery(
    importType ? { importType } : undefined
  );
}

export function useCreateTemplate() {
  const utils = trpc.useUtils();
  return trpc.migration.createTemplate.useMutation({
    onSuccess: () => {
      void utils.migration.listTemplates.invalidate();
    },
  });
}

export function useUpdateTemplate() {
  const utils = trpc.useUtils();
  return trpc.migration.updateTemplate.useMutation({
    onSuccess: () => {
      void utils.migration.listTemplates.invalidate();
    },
  });
}

export function useDeleteTemplate() {
  const utils = trpc.useUtils();
  return trpc.migration.deleteTemplate.useMutation({
    onSuccess: () => {
      void utils.migration.listTemplates.invalidate();
    },
  });
}

// ============================================================================
// Account Mapping Hooks
// ============================================================================

export function useAccountMappings(sessionId: string) {
  return trpc.migration.getMappingSuggestions.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
}

export function usePendingMappings(sessionId: string) {
  return trpc.migration.getPendingMappings.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
}

export function useUpdateMappingStatus() {
  const utils = trpc.useUtils();
  return trpc.migration.updateMappingStatus.useMutation({
    onSuccess: () => {
      void utils.migration.getMappingSuggestions.invalidate();
      void utils.migration.getPendingMappings.invalidate();
    },
  });
}

export function useAutoAcceptMappings() {
  const utils = trpc.useUtils();
  return trpc.migration.autoAcceptMappings.useMutation({
    onSuccess: () => {
      void utils.migration.getMappingSuggestions.invalidate();
      void utils.migration.getPendingMappings.invalidate();
    },
  });
}

export function useGenerateMappingSuggestions() {
  const utils = trpc.useUtils();
  return trpc.migration.generateMappingSuggestions.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getMappingSuggestions.invalidate({ sessionId: variables.sessionId });
      void utils.migration.getPendingMappings.invalidate({ sessionId: variables.sessionId });
    },
  });
}

// ============================================================================
// Payroll YTD Hooks
// ============================================================================

export function usePayrollYtd(sessionId: string) {
  return trpc.migration.getPayrollYtd.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
}

export function useAddPayrollYtd() {
  const utils = trpc.useUtils();
  return trpc.migration.addPayrollYtd.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getPayrollYtd.invalidate({ sessionId: variables.sessionId });
    },
  });
}

export function useBulkAddPayrollYtd() {
  const utils = trpc.useUtils();
  return trpc.migration.bulkAddPayrollYtd.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getPayrollYtd.invalidate({ sessionId: variables.sessionId });
    },
  });
}

export function useUpdatePayrollYtd() {
  const utils = trpc.useUtils();
  return trpc.migration.updatePayrollYtd.useMutation({
    onSuccess: () => {
      void utils.migration.getPayrollYtd.invalidate();
    },
  });
}

export function useDeletePayrollYtd() {
  const utils = trpc.useUtils();
  return trpc.migration.deletePayrollYtd.useMutation({
    onSuccess: () => {
      void utils.migration.getPayrollYtd.invalidate();
    },
  });
}

// ============================================================================
// Demo Data Hooks
// ============================================================================

export function useRequestDemoData() {
  const utils = trpc.useUtils();
  return trpc.migration.requestDemoData.useMutation({
    onSuccess: () => {
      void utils.migration.getDemoDataStatus.invalidate();
    },
  });
}

export function useDemoDataStatus() {
  return trpc.migration.getDemoDataStatus.useQuery();
}

// ============================================================================
// Validation & Apply Hooks
// ============================================================================

export function useValidateSession() {
  const utils = trpc.useUtils();
  return trpc.migration.validateSession.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getSession.invalidate({ id: variables.sessionId });
    },
  });
}

export function useApplyOpeningBalances() {
  const utils = trpc.useUtils();
  return trpc.migration.applyOpeningBalances.useMutation({
    onSuccess: (_, variables) => {
      void utils.migration.getSession.invalidate({ id: variables.sessionId });
      void utils.migration.listSessions.invalidate();
      // Invalidate accounting data as opening balances affect them
      void utils.ledger.invalidate();
      void utils.chartOfAccounts.invalidate();
    },
  });
}
