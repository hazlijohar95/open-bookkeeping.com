/**
 * Payroll API hooks
 * React Query hooks for payroll operations using tRPC
 */

import { trpc } from "@/trpc/provider";

// ============================================================================
// Types
// ============================================================================

export type EmployeeStatus = "active" | "probation" | "terminated" | "resigned" | "retired";
export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type NationalityType = "malaysian" | "permanent_resident" | "foreign";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
export type ComponentType = "earnings" | "deductions";
export type CalculationMethod = "fixed" | "percentage" | "hourly" | "daily";
export type PayFrequency = "monthly" | "bi_weekly" | "weekly";
export type PayrollRunStatus = "draft" | "calculating" | "pending_review" | "approved" | "finalized" | "paid" | "cancelled";
export type PaySlipStatus = "draft" | "calculated" | "approved" | "paid" | "cancelled";

export interface Employee {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  icNumber: string | null;
  passportNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  nationality: NationalityType;
  dateOfBirth: string | null;
  dateJoined: string;
  dateResigned: string | null;
  department: string | null;
  position: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  taxNumber: string | null;
  maritalStatus: MaritalStatus | null;
  spouseWorking: boolean | null;
  numberOfChildren: number | null;
  childrenInUniversity: number | null;
  disabledChildren: number | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  eisNumber: string | null;
  epfEmployeeRate: string | null;
  epfEmployerRate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  baseSalary: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  payFrequency: PayFrequency;
  createdAt: Date;
}

export interface SalaryComponent {
  id: string;
  userId: string;
  code: string;
  name: string;
  description: string | null;
  componentType: ComponentType;
  calculationMethod: CalculationMethod;
  defaultAmount: string | null;
  defaultPercentage: string | null;
  isEpfApplicable: boolean;
  isSocsoApplicable: boolean;
  isEisApplicable: boolean;
  isPcbApplicable: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface PayrollRun {
  id: string;
  userId: string;
  runNumber: string;
  name: string | null;
  periodYear: number;
  periodMonth: number;
  payDate: string | null;
  periodStartDate: string | null;
  periodEndDate: string | null;
  status: PayrollRunStatus;
  totalEmployees: number | null;
  totalGrossSalary: string | null;
  totalDeductions: string | null;
  totalNetSalary: string | null;
  totalEpfEmployer: string | null;
  totalEpfEmployee: string | null;
  totalSocsoEmployer: string | null;
  totalSocsoEmployee: string | null;
  totalEisEmployer: string | null;
  totalEisEmployee: string | null;
  totalPcb: string | null;
  journalEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaySlip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  slipNumber: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  position: string | null;
  icNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  baseSalary: string;
  workingDays: number | null;
  daysWorked: number | null;
  totalEarnings: string | null;
  grossSalary: string | null;
  epfEmployee: string | null;
  epfEmployer: string | null;
  epfWage: string | null;
  socsoEmployee: string | null;
  socsoEmployer: string | null;
  socsoWage: string | null;
  eisEmployee: string | null;
  eisEmployer: string | null;
  eisWage: string | null;
  pcb: string | null;
  pcbWage: string | null;
  totalDeductions: string | null;
  netSalary: string | null;
  ytdGrossSalary: string | null;
  ytdEpfEmployee: string | null;
  ytdPcb: string | null;
  status: PaySlipStatus;
  createdAt: Date;
}

export interface PaySlipItem {
  id: string;
  paySlipId: string;
  salaryComponentId: string | null;
  componentCode: string;
  componentName: string;
  componentType: ComponentType;
  amount: string;
  calculationDetails: Record<string, unknown> | null;
  isEpfApplicable: boolean;
  isSocsoApplicable: boolean;
  isEisApplicable: boolean;
  isPcbApplicable: boolean;
  sortOrder: number | null;
}

export interface EmployeeListParams {
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  department?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PayrollRunListParams {
  year?: number;
  status?: PayrollRunStatus;
  limit?: number;
  offset?: number;
}

export interface CreateEmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName?: string;
  icNumber?: string;
  passportNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  nationality?: NationalityType;
  dateOfBirth?: string;
  dateJoined: string;
  department?: string;
  position?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  taxNumber?: string;
  maritalStatus?: MaritalStatus;
  spouseWorking?: boolean;
  numberOfChildren?: number;
  childrenInUniversity?: number;
  disabledChildren?: number;
  epfNumber?: string;
  socsoNumber?: string;
  eisNumber?: string;
  epfEmployeeRate?: string;
  epfEmployerRate?: string;
  baseSalary: string;
  payFrequency?: PayFrequency;
}

export interface UpdateEmployeeInput {
  id: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string | null;
  icNumber?: string | null;
  passportNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  nationality?: NationalityType;
  dateOfBirth?: string | null;
  dateJoined?: string;
  dateResigned?: string | null;
  department?: string | null;
  position?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  taxNumber?: string | null;
  maritalStatus?: MaritalStatus | null;
  spouseWorking?: boolean | null;
  numberOfChildren?: number | null;
  childrenInUniversity?: number | null;
  disabledChildren?: number | null;
  epfNumber?: string | null;
  socsoNumber?: string | null;
  eisNumber?: string | null;
  epfEmployeeRate?: string | null;
  epfEmployerRate?: string | null;
}

export interface CreatePayrollRunInput {
  name?: string;
  periodYear: number;
  periodMonth: number;
  payDate: string;
  periodStartDate?: string;
  periodEndDate?: string;
}

export interface CreateComponentInput {
  code: string;
  name: string;
  description?: string;
  componentType: ComponentType;
  calculationMethod?: CalculationMethod;
  defaultAmount?: string;
  defaultPercentage?: string;
  isEpfApplicable?: boolean;
  isSocsoApplicable?: boolean;
  isEisApplicable?: boolean;
  isPcbApplicable?: boolean;
}

// ============================================================================
// Employee Hooks
// ============================================================================

export function useEmployees(params?: EmployeeListParams) {
  return trpc.payroll.listEmployees.useQuery(params);
}

export function useEmployee(id: string) {
  return trpc.payroll.getEmployee.useQuery({ id }, { enabled: !!id });
}

export function useCreateEmployee() {
  const utils = trpc.useUtils();
  return trpc.payroll.createEmployee.useMutation({
    onSuccess: () => {
      void utils.payroll.listEmployees.invalidate();
      void utils.payroll.getEmployeeStats.invalidate();
    },
  });
}

export function useUpdateEmployee() {
  const utils = trpc.useUtils();
  return trpc.payroll.updateEmployee.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.listEmployees.invalidate();
      void utils.payroll.getEmployee.invalidate({ id: variables.id });
    },
  });
}

export function useTerminateEmployee() {
  const utils = trpc.useUtils();
  return trpc.payroll.terminateEmployee.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.listEmployees.invalidate();
      void utils.payroll.getEmployee.invalidate({ id: variables.id });
      void utils.payroll.getEmployeeStats.invalidate();
    },
  });
}

export function useDeleteEmployee() {
  const utils = trpc.useUtils();
  return trpc.payroll.deleteEmployee.useMutation({
    onSuccess: () => {
      void utils.payroll.listEmployees.invalidate();
      void utils.payroll.getEmployeeStats.invalidate();
    },
  });
}

export function useSalaryHistory(employeeId: string) {
  return trpc.payroll.getSalaryHistory.useQuery({ employeeId }, { enabled: !!employeeId });
}

export function useUpdateSalary() {
  const utils = trpc.useUtils();
  return trpc.payroll.updateSalary.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.getSalaryHistory.invalidate({ employeeId: variables.employeeId });
    },
  });
}

export function useDepartments() {
  return trpc.payroll.getDepartments.useQuery();
}

export function useEmployeeStats() {
  return trpc.payroll.getEmployeeStats.useQuery();
}

// ============================================================================
// Salary Component Hooks
// ============================================================================

export function useSalaryComponents(componentType?: ComponentType) {
  return trpc.payroll.listComponents.useQuery(
    componentType ? { componentType } : undefined
  );
}

export function useCreateComponent() {
  const utils = trpc.useUtils();
  return trpc.payroll.createComponent.useMutation({
    onSuccess: () => {
      void utils.payroll.listComponents.invalidate();
    },
  });
}

export function useUpdateComponent() {
  const utils = trpc.useUtils();
  return trpc.payroll.updateComponent.useMutation({
    onSuccess: () => {
      void utils.payroll.listComponents.invalidate();
    },
  });
}

export function useDeleteComponent() {
  const utils = trpc.useUtils();
  return trpc.payroll.deleteComponent.useMutation({
    onSuccess: () => {
      void utils.payroll.listComponents.invalidate();
    },
  });
}

// ============================================================================
// Payroll Run Hooks
// ============================================================================

export function usePayrollRuns(params?: PayrollRunListParams) {
  return trpc.payroll.listPayrollRuns.useQuery(params);
}

export function usePayrollRun(id: string) {
  return trpc.payroll.getPayrollRun.useQuery({ id }, { enabled: !!id });
}

export function useCreatePayrollRun() {
  const utils = trpc.useUtils();
  return trpc.payroll.createPayrollRun.useMutation({
    onSuccess: () => {
      void utils.payroll.listPayrollRuns.invalidate();
    },
  });
}

export function useCalculatePayroll() {
  const utils = trpc.useUtils();
  return trpc.payroll.calculatePayroll.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.getPayrollRun.invalidate({ id: variables.payrollRunId });
      void utils.payroll.getPaySlips.invalidate({ payrollRunId: variables.payrollRunId });
    },
  });
}

export function useApprovePayrollRun() {
  const utils = trpc.useUtils();
  return trpc.payroll.approvePayrollRun.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.listPayrollRuns.invalidate();
      void utils.payroll.getPayrollRun.invalidate({ id: variables.id });
    },
  });
}

export function useFinalizePayrollRun() {
  const utils = trpc.useUtils();
  return trpc.payroll.finalizePayrollRun.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.listPayrollRuns.invalidate();
      void utils.payroll.getPayrollRun.invalidate({ id: variables.id });
      void utils.payroll.getPaySlips.invalidate({ payrollRunId: variables.id });
    },
  });
}

export function useMarkPayrollPaid() {
  const utils = trpc.useUtils();
  return trpc.payroll.markPayrollPaid.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.listPayrollRuns.invalidate();
      void utils.payroll.getPayrollRun.invalidate({ id: variables.id });
      void utils.payroll.getPaySlips.invalidate({ payrollRunId: variables.id });
    },
  });
}

export function useCancelPayrollRun() {
  const utils = trpc.useUtils();
  return trpc.payroll.cancelPayrollRun.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.listPayrollRuns.invalidate();
      void utils.payroll.getPayrollRun.invalidate({ id: variables.id });
    },
  });
}

export function useDeletePayrollRun() {
  const utils = trpc.useUtils();
  return trpc.payroll.deletePayrollRun.useMutation({
    onSuccess: () => {
      void utils.payroll.listPayrollRuns.invalidate();
    },
  });
}

// ============================================================================
// Pay Slip Hooks
// ============================================================================

export function usePaySlips(payrollRunId: string) {
  return trpc.payroll.getPaySlips.useQuery({ payrollRunId }, { enabled: !!payrollRunId });
}

export function usePaySlip(id: string) {
  return trpc.payroll.getPaySlip.useQuery({ id }, { enabled: !!id });
}

export function useEmployeePayHistory(employeeId: string, limit = 12) {
  return trpc.payroll.getEmployeePayHistory.useQuery(
    { employeeId, limit },
    { enabled: !!employeeId }
  );
}

export function useAddPaySlipItem() {
  const utils = trpc.useUtils();
  return trpc.payroll.addPaySlipItem.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.getPaySlip.invalidate({ id: variables.paySlipId });
    },
  });
}

export function useRemovePaySlipItem() {
  const utils = trpc.useUtils();
  return trpc.payroll.removePaySlipItem.useMutation({
    onSuccess: () => {
      // We don't have paySlipId in the mutation result, so invalidate all
      void utils.payroll.getPaySlip.invalidate();
    },
  });
}

export function useRecalculatePaySlip() {
  const utils = trpc.useUtils();
  return trpc.payroll.recalculatePaySlip.useMutation({
    onSuccess: (_, variables) => {
      void utils.payroll.getPaySlip.invalidate({ id: variables.paySlipId });
    },
  });
}

// ============================================================================
// Statutory & Utility Hooks
// ============================================================================

export function useStatutoryInfo() {
  return trpc.payroll.getStatutoryInfo.useQuery();
}

export function useCalculateStatutory(params: {
  grossWage: string;
  nationality: NationalityType;
  dateOfBirth?: string;
  maritalStatus?: MaritalStatus;
  spouseWorking?: boolean;
  numberOfChildren?: number;
  childrenInUniversity?: number;
  disabledChildren?: number;
  currentMonth: number;
  ytdGross?: string;
  ytdEpf?: string;
  ytdPcb?: string;
}, enabled = true) {
  return trpc.payroll.calculateStatutory.useQuery(params, { enabled });
}

export function useStatutoryPaymentSummary(payrollRunId: string) {
  return trpc.payroll.getStatutoryPaymentSummary.useQuery(
    { payrollRunId },
    { enabled: !!payrollRunId }
  );
}
