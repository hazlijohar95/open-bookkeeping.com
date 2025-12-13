/**
 * Payroll Calculation Service
 *
 * Orchestrates the entire payroll calculation process:
 * 1. Load employees and their salaries
 * 2. Calculate gross salary (base + earnings - deductions)
 * 3. Calculate statutory deductions (EPF, SOCSO, EIS, PCB)
 * 4. Calculate net salary
 * 5. Update pay slips with calculated values
 */

import Decimal from "decimal.js";
import { createLogger } from "@open-bookkeeping/shared";
import {
  employeeRepository,
  employeeSalaryRepository,
  salaryComponentRepository,
  payrollRunRepository,
  paySlipRepository,
  paySlipItemRepository,
  type CreatePaySlipItemInput,
  type UpdatePaySlipCalculationsInput,
} from "@open-bookkeeping/db";
import {
  calculateAllStatutory,
  type EmployeeStatutoryInfo,
  type StatutoryCalculationResult,
} from "./statutory.service";

const logger = createLogger("payroll-calculation");

// ============================================================================
// TYPES
// ============================================================================

interface PayrollRunContext {
  userId: string;
  payrollRunId: string;
  periodYear: number;
  periodMonth: number;
  runNumber: string;
}

interface EmployeePayrollData {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  position: string | null;
  icNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  baseSalary: Decimal;
  nationality: string;
  dateOfBirth: string | null;
  maritalStatus: string;
  spouseWorking: boolean;
  numberOfChildren: number;
  childrenInUniversity: number;
  disabledChildren: number;
  epfEmployeeRate: string | null;
  epfEmployerRate: string | null;
}

interface PaySlipCalculation {
  paySlipId: string;
  employeeId: string;
  baseSalary: Decimal;
  totalEarnings: Decimal;
  totalDeductions: Decimal;
  grossSalary: Decimal;
  statutory: StatutoryCalculationResult;
  netSalary: Decimal;
  ytdGrossSalary: Decimal;
  ytdEpfEmployee: Decimal;
  ytdPcb: Decimal;
}

export interface PayrollCalculationResult {
  success: boolean;
  payrollRunId: string;
  totalEmployees: number;
  totalGrossSalary: string;
  totalDeductions: string;
  totalNetSalary: string;
  totalEpfEmployer: string;
  totalEpfEmployee: string;
  totalSocsoEmployer: string;
  totalSocsoEmployee: string;
  totalEisEmployer: string;
  totalEisEmployee: string;
  totalPcb: string;
  errors: string[];
}

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Run payroll calculation for a specific payroll run
 */
export async function calculatePayroll(
  context: PayrollRunContext
): Promise<PayrollCalculationResult> {
  const { userId, payrollRunId, periodYear, periodMonth, runNumber } = context;
  const errors: string[] = [];

  logger.info({ payrollRunId, periodYear, periodMonth }, "Starting payroll calculation");

  try {
    // 1. Update status to calculating
    await payrollRunRepository.updateStatus(payrollRunId, userId, "calculating", userId);

    // 2. Clear existing pay slips (for recalculation)
    await paySlipRepository.deleteByPayrollRun(payrollRunId);

    // 3. Get active employees
    const employees = await employeeRepository.findActiveForPayroll(userId);

    if (employees.length === 0) {
      await payrollRunRepository.updateStatus(payrollRunId, userId, "draft", userId);
      return {
        success: false,
        payrollRunId,
        totalEmployees: 0,
        totalGrossSalary: "0.00",
        totalDeductions: "0.00",
        totalNetSalary: "0.00",
        totalEpfEmployer: "0.00",
        totalEpfEmployee: "0.00",
        totalSocsoEmployer: "0.00",
        totalSocsoEmployee: "0.00",
        totalEisEmployer: "0.00",
        totalEisEmployee: "0.00",
        totalPcb: "0.00",
        errors: ["No active employees found"],
      };
    }

    // 4. Get salary components
    const earningsComponents = await salaryComponentRepository.findMany(userId, "earnings");
    const deductionsComponents = await salaryComponentRepository.findMany(userId, "deductions");

    // 5. Process each employee
    const calculations: PaySlipCalculation[] = [];
    let slipSequence = 1;

    for (const employee of employees) {
      try {
        // Get current salary
        const currentSalary = employee.salaries?.[0];
        if (!currentSalary) {
          errors.push(`No salary record for employee ${employee.employeeCode}`);
          continue;
        }

        // Prepare employee data
        const employeeData: EmployeePayrollData = {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          employeeName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
          department: employee.department,
          position: employee.position,
          icNumber: employee.icNumber,
          bankName: employee.bankName,
          bankAccountNumber: employee.bankAccountNumber,
          baseSalary: new Decimal(currentSalary.baseSalary),
          nationality: employee.nationality,
          dateOfBirth: employee.dateOfBirth,
          maritalStatus: employee.maritalStatus ?? "single",
          spouseWorking: employee.spouseWorking ?? true,
          numberOfChildren: employee.numberOfChildren ?? 0,
          childrenInUniversity: employee.childrenInUniversity ?? 0,
          disabledChildren: employee.disabledChildren ?? 0,
          epfEmployeeRate: employee.epfEmployeeRate,
          epfEmployerRate: employee.epfEmployerRate,
        };

        // Create pay slip
        const slipNumber = `PS-${runNumber}-${slipSequence.toString().padStart(3, "0")}`;
        const paySlip = await paySlipRepository.create({
          payrollRunId,
          employeeId: employee.id,
          slipNumber,
          employeeCode: employeeData.employeeCode,
          employeeName: employeeData.employeeName,
          department: employeeData.department,
          position: employeeData.position,
          icNumber: employeeData.icNumber,
          bankName: employeeData.bankName,
          bankAccountNumber: employeeData.bankAccountNumber,
          baseSalary: employeeData.baseSalary.toFixed(2),
        });

        if (!paySlip) {
          errors.push(`Failed to create pay slip for ${employee.employeeCode}`);
          continue;
        }

        // Calculate pay slip
        const calculation = await calculateEmployeePaySlip(
          paySlip.id,
          employeeData,
          earningsComponents,
          deductionsComponents,
          periodYear,
          periodMonth
        );

        calculations.push(calculation);
        slipSequence++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error processing ${employee.employeeCode}: ${message}`);
        logger.error({ employeeCode: employee.employeeCode, error }, "Error processing employee");
      }
    }

    // 6. Calculate totals
    const totals = calculateTotals(calculations);

    // 7. Update payroll run with totals
    await payrollRunRepository.updateTotals(payrollRunId, userId, {
      totalEmployees: calculations.length,
      totalGrossSalary: totals.totalGrossSalary,
      totalDeductions: totals.totalDeductions,
      totalNetSalary: totals.totalNetSalary,
      totalEpfEmployer: totals.totalEpfEmployer,
      totalEpfEmployee: totals.totalEpfEmployee,
      totalSocsoEmployer: totals.totalSocsoEmployer,
      totalSocsoEmployee: totals.totalSocsoEmployee,
      totalEisEmployer: totals.totalEisEmployer,
      totalEisEmployee: totals.totalEisEmployee,
      totalPcb: totals.totalPcb,
    });

    // 8. Update status to pending review
    await payrollRunRepository.updateStatus(payrollRunId, userId, "pending_review", userId);

    logger.info({
      payrollRunId,
      employeesProcessed: calculations.length,
      errors: errors.length,
    }, "Payroll calculation completed");

    return {
      success: true,
      payrollRunId,
      ...totals,
      totalEmployees: calculations.length,
      errors,
    };
  } catch (error) {
    logger.error({ payrollRunId, error }, "Payroll calculation failed");
    await payrollRunRepository.updateStatus(payrollRunId, userId, "draft", userId);
    throw error;
  }
}

// Type for salary component from repository
interface SalaryComponentData {
  id: string;
  code: string;
  name: string;
  componentType: "earnings" | "deductions";
  calculationMethod: "fixed" | "percentage" | "hourly" | "daily";
  defaultAmount: string | null;
  defaultPercentage: string | null;
  isEpfApplicable: boolean;
  isSocsoApplicable: boolean;
  isEisApplicable: boolean;
  isPcbApplicable: boolean;
  sortOrder: number | null;
  isActive: boolean;
}

/**
 * Calculate a single employee's pay slip
 */
async function calculateEmployeePaySlip(
  paySlipId: string,
  employee: EmployeePayrollData,
  earningsComponents: SalaryComponentData[],
  deductionsComponents: SalaryComponentData[],
  periodYear: number,
  periodMonth: number
): Promise<PaySlipCalculation> {
  const baseSalary = employee.baseSalary;
  let totalEarnings = new Decimal(0);
  let totalDeductions = new Decimal(0);
  const paySlipItems: CreatePaySlipItemInput[] = [];

  // Add base salary as an earning item
  paySlipItems.push({
    paySlipId,
    componentCode: "BASIC",
    componentName: "Basic Salary",
    componentType: "earnings",
    amount: baseSalary.toFixed(2),
    calculationDetails: { method: "fixed" },
    isEpfApplicable: true,
    isSocsoApplicable: true,
    isEisApplicable: true,
    isPcbApplicable: true,
    sortOrder: 0,
  });
  totalEarnings = totalEarnings.add(baseSalary);

  // Process additional earnings (allowances, bonuses, etc.)
  // Apply all active earning components with default amounts
  let earningsSortOrder = 1;
  for (const component of earningsComponents) {
    if (!component.isActive) continue;

    let amount = new Decimal(0);
    const details: { method: string; baseAmount?: string; percentage?: string; fixedAmount?: string } = {
      method: component.calculationMethod,
    };

    if (component.calculationMethod === "fixed" && component.defaultAmount) {
      amount = new Decimal(component.defaultAmount);
      details.fixedAmount = component.defaultAmount;
    } else if (component.calculationMethod === "percentage" && component.defaultPercentage) {
      // Percentage of base salary
      amount = baseSalary.times(component.defaultPercentage).dividedBy(100);
      details.percentage = component.defaultPercentage;
      details.baseAmount = baseSalary.toFixed(2);
    }

    // Only add if there's a non-zero amount
    if (amount.greaterThan(0)) {
      paySlipItems.push({
        paySlipId,
        salaryComponentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        componentType: "earnings",
        amount: amount.toFixed(2),
        calculationDetails: details,
        isEpfApplicable: component.isEpfApplicable,
        isSocsoApplicable: component.isSocsoApplicable,
        isEisApplicable: component.isEisApplicable,
        isPcbApplicable: component.isPcbApplicable,
        sortOrder: earningsSortOrder++,
      });
      totalEarnings = totalEarnings.add(amount);
    }
  }

  // Process deductions (loans, advances, etc.)
  // Apply all active deduction components with default amounts
  let deductionsSortOrder = 100;
  for (const component of deductionsComponents) {
    if (!component.isActive) continue;

    let amount = new Decimal(0);
    const details: { method: string; baseAmount?: string; percentage?: string; fixedAmount?: string } = {
      method: component.calculationMethod,
    };

    if (component.calculationMethod === "fixed" && component.defaultAmount) {
      amount = new Decimal(component.defaultAmount);
      details.fixedAmount = component.defaultAmount;
    } else if (component.calculationMethod === "percentage" && component.defaultPercentage) {
      // Percentage of base salary
      amount = baseSalary.times(component.defaultPercentage).dividedBy(100);
      details.percentage = component.defaultPercentage;
      details.baseAmount = baseSalary.toFixed(2);
    }

    // Only add if there's a non-zero amount
    if (amount.greaterThan(0)) {
      paySlipItems.push({
        paySlipId,
        salaryComponentId: component.id,
        componentCode: component.code,
        componentName: component.name,
        componentType: "deductions",
        amount: amount.toFixed(2),
        calculationDetails: details,
        isEpfApplicable: component.isEpfApplicable,
        isSocsoApplicable: component.isSocsoApplicable,
        isEisApplicable: component.isEisApplicable,
        isPcbApplicable: component.isPcbApplicable,
        sortOrder: deductionsSortOrder++,
      });
      totalDeductions = totalDeductions.add(amount);
    }
  }

  // Calculate gross salary
  const grossSalary = baseSalary.add(totalEarnings.sub(baseSalary)).sub(totalDeductions);

  // Get YTD totals for tax calculation
  const ytdTotals = await paySlipRepository.getYTDTotals(employee.employeeId, periodYear, periodMonth);

  // Calculate statutory deductions
  const statutoryInfo: EmployeeStatutoryInfo = {
    nationality: employee.nationality as any,
    dateOfBirth: employee.dateOfBirth,
    maritalStatus: employee.maritalStatus as any,
    spouseWorking: employee.spouseWorking,
    numberOfChildren: employee.numberOfChildren,
    childrenInUniversity: employee.childrenInUniversity,
    disabledChildren: employee.disabledChildren,
    epfEmployeeRate: employee.epfEmployeeRate,
    epfEmployerRate: employee.epfEmployerRate,
  };

  const statutory = calculateAllStatutory({
    grossWage: grossSalary.toFixed(2),
    employee: statutoryInfo,
    currentMonth: periodMonth,
    ytdGross: ytdTotals.ytdGrossSalary,
    ytdEpf: ytdTotals.ytdEpfEmployee,
    ytdSocsoEis: ytdTotals.ytdSocsoEis,
    ytdPcb: ytdTotals.ytdPcb,
  });

  // Add statutory deduction items
  if (parseFloat(statutory.epf.employeeContribution) > 0) {
    paySlipItems.push({
      paySlipId,
      componentCode: "EPF_EE",
      componentName: "EPF (Employee)",
      componentType: "deductions",
      amount: statutory.epf.employeeContribution,
      calculationDetails: {
        method: "statutory",
        rate: statutory.epf.employeeRate,
        baseAmount: statutory.epf.applicableWage,
      },
      isEpfApplicable: false,
      isSocsoApplicable: false,
      isEisApplicable: false,
      isPcbApplicable: false,
      sortOrder: 100,
    });
  }

  if (parseFloat(statutory.socso.employeeContribution) > 0) {
    paySlipItems.push({
      paySlipId,
      componentCode: "SOCSO_EE",
      componentName: "SOCSO (Employee)",
      componentType: "deductions",
      amount: statutory.socso.employeeContribution,
      calculationDetails: {
        method: "statutory",
        baseAmount: statutory.socso.applicableWage,
      },
      isEpfApplicable: false,
      isSocsoApplicable: false,
      isEisApplicable: false,
      isPcbApplicable: false,
      sortOrder: 101,
    });
  }

  if (parseFloat(statutory.eis.employeeContribution) > 0) {
    paySlipItems.push({
      paySlipId,
      componentCode: "EIS_EE",
      componentName: "EIS (Employee)",
      componentType: "deductions",
      amount: statutory.eis.employeeContribution,
      calculationDetails: {
        method: "statutory",
        baseAmount: statutory.eis.applicableWage,
      },
      isEpfApplicable: false,
      isSocsoApplicable: false,
      isEisApplicable: false,
      isPcbApplicable: false,
      sortOrder: 102,
    });
  }

  if (parseFloat(statutory.pcb.amount) > 0) {
    paySlipItems.push({
      paySlipId,
      componentCode: "PCB",
      componentName: "PCB (Tax)",
      componentType: "deductions",
      amount: statutory.pcb.amount,
      calculationDetails: {
        method: "statutory",
        baseAmount: statutory.pcb.taxableIncome,
      },
      isEpfApplicable: false,
      isSocsoApplicable: false,
      isEisApplicable: false,
      isPcbApplicable: false,
      sortOrder: 103,
    });
  }

  // Calculate net salary
  const statutoryEmployeeTotal = new Decimal(statutory.totalEmployeeDeductions);
  const totalAllDeductions = totalDeductions.add(statutoryEmployeeTotal);
  const netSalary = grossSalary.sub(statutoryEmployeeTotal);

  // Save pay slip items
  await paySlipItemRepository.bulkCreate(paySlipItems);

  // Update pay slip with calculations
  const ytdGrossSalary = new Decimal(ytdTotals.ytdGrossSalary).add(grossSalary);
  const ytdEpfEmployee = new Decimal(ytdTotals.ytdEpfEmployee).add(statutory.epf.employeeContribution);
  const ytdPcb = new Decimal(ytdTotals.ytdPcb).add(statutory.pcb.amount);

  const updateInput: UpdatePaySlipCalculationsInput = {
    totalEarnings: totalEarnings.toFixed(2),
    grossSalary: grossSalary.toFixed(2),
    epfEmployee: statutory.epf.employeeContribution,
    epfEmployer: statutory.epf.employerContribution,
    epfWage: statutory.epf.applicableWage,
    socsoEmployee: statutory.socso.employeeContribution,
    socsoEmployer: statutory.socso.employerContribution,
    socsoWage: statutory.socso.applicableWage,
    eisEmployee: statutory.eis.employeeContribution,
    eisEmployer: statutory.eis.employerContribution,
    eisWage: statutory.eis.applicableWage,
    pcb: statutory.pcb.amount,
    pcbWage: statutory.pcb.taxableIncome,
    totalDeductions: totalAllDeductions.toFixed(2),
    netSalary: netSalary.toFixed(2),
    ytdGrossSalary: ytdGrossSalary.toFixed(2),
    ytdEpfEmployee: ytdEpfEmployee.toFixed(2),
    ytdPcb: ytdPcb.toFixed(2),
  };

  await paySlipRepository.updateCalculations(paySlipId, updateInput);

  return {
    paySlipId,
    employeeId: employee.employeeId,
    baseSalary,
    totalEarnings,
    totalDeductions,
    grossSalary,
    statutory,
    netSalary,
    ytdGrossSalary,
    ytdEpfEmployee,
    ytdPcb,
  };
}

/**
 * Calculate totals from all pay slip calculations
 */
function calculateTotals(calculations: PaySlipCalculation[]): {
  totalGrossSalary: string;
  totalDeductions: string;
  totalNetSalary: string;
  totalEpfEmployer: string;
  totalEpfEmployee: string;
  totalSocsoEmployer: string;
  totalSocsoEmployee: string;
  totalEisEmployer: string;
  totalEisEmployee: string;
  totalPcb: string;
} {
  const totals = calculations.reduce(
    (acc, calc) => {
      return {
        grossSalary: acc.grossSalary.add(calc.grossSalary),
        deductions: acc.deductions.add(calc.statutory.totalEmployeeDeductions),
        netSalary: acc.netSalary.add(calc.netSalary),
        epfEmployer: acc.epfEmployer.add(calc.statutory.epf.employerContribution),
        epfEmployee: acc.epfEmployee.add(calc.statutory.epf.employeeContribution),
        socsoEmployer: acc.socsoEmployer.add(calc.statutory.socso.employerContribution),
        socsoEmployee: acc.socsoEmployee.add(calc.statutory.socso.employeeContribution),
        eisEmployer: acc.eisEmployer.add(calc.statutory.eis.employerContribution),
        eisEmployee: acc.eisEmployee.add(calc.statutory.eis.employeeContribution),
        pcb: acc.pcb.add(calc.statutory.pcb.amount),
      };
    },
    {
      grossSalary: new Decimal(0),
      deductions: new Decimal(0),
      netSalary: new Decimal(0),
      epfEmployer: new Decimal(0),
      epfEmployee: new Decimal(0),
      socsoEmployer: new Decimal(0),
      socsoEmployee: new Decimal(0),
      eisEmployer: new Decimal(0),
      eisEmployee: new Decimal(0),
      pcb: new Decimal(0),
    }
  );

  return {
    totalGrossSalary: totals.grossSalary.toFixed(2),
    totalDeductions: totals.deductions.toFixed(2),
    totalNetSalary: totals.netSalary.toFixed(2),
    totalEpfEmployer: totals.epfEmployer.toFixed(2),
    totalEpfEmployee: totals.epfEmployee.toFixed(2),
    totalSocsoEmployer: totals.socsoEmployer.toFixed(2),
    totalSocsoEmployee: totals.socsoEmployee.toFixed(2),
    totalEisEmployer: totals.eisEmployer.toFixed(2),
    totalEisEmployee: totals.eisEmployee.toFixed(2),
    totalPcb: totals.pcb.toFixed(2),
  };
}

/**
 * Recalculate a single pay slip
 */
export async function recalculatePaySlip(
  paySlipId: string,
  userId: string
): Promise<PaySlipCalculation | null> {
  const paySlip = await paySlipRepository.findById(paySlipId);
  if (!paySlip) return null;

  const payrollRun = paySlip.payrollRun;
  if (!payrollRun) return null;

  const employee = paySlip.employee;
  if (!employee) return null;

  // Get current salary
  const currentSalary = await employeeSalaryRepository.getCurrentSalary(employee.id);
  if (!currentSalary) return null;

  // Clear existing items
  await paySlipItemRepository.deleteByPaySlip(paySlipId);

  // Get salary components
  const earningsComponents = await salaryComponentRepository.findMany(userId, "earnings");
  const deductionsComponents = await salaryComponentRepository.findMany(userId, "deductions");

  // Prepare employee data
  const employeeData: EmployeePayrollData = {
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    employeeName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
    department: employee.department,
    position: employee.position,
    icNumber: employee.icNumber,
    bankName: employee.bankName,
    bankAccountNumber: employee.bankAccountNumber,
    baseSalary: new Decimal(currentSalary.baseSalary),
    nationality: employee.nationality,
    dateOfBirth: employee.dateOfBirth,
    maritalStatus: employee.maritalStatus ?? "single",
    spouseWorking: employee.spouseWorking ?? true,
    numberOfChildren: employee.numberOfChildren ?? 0,
    childrenInUniversity: employee.childrenInUniversity ?? 0,
    disabledChildren: employee.disabledChildren ?? 0,
    epfEmployeeRate: employee.epfEmployeeRate,
    epfEmployerRate: employee.epfEmployerRate,
  };

  // Recalculate
  return calculateEmployeePaySlip(
    paySlipId,
    employeeData,
    earningsComponents,
    deductionsComponents,
    payrollRun.periodYear,
    payrollRun.periodMonth
  );
}
