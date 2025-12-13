/**
 * Malaysian Statutory Contribution Calculation Service
 *
 * Handles calculations for:
 * - EPF (KWSP) - Employees Provident Fund
 * - SOCSO (PERKESO) - Social Security Organization
 * - EIS (SIP) - Employment Insurance System
 * - PCB (MTD) - Monthly Tax Deduction
 *
 * References:
 * - KWSP: https://www.kwsp.gov.my/
 * - PERKESO: https://www.perkeso.gov.my/
 * - EIS: https://www.eis.gov.my/
 * - LHDN PCB: https://calcpcb.hasil.gov.my/
 */

import Decimal from "decimal.js";
import { createLogger } from "@open-bookkeeping/shared";
import type { NationalityType, MaritalStatus } from "@open-bookkeeping/db";

const logger = createLogger("statutory-service");

// ============================================================================
// CONSTANTS
// ============================================================================

const EPF_WAGE_CEILING = 20000;
const SOCSO_WAGE_CEILING = 6000;
const EIS_WAGE_CEILING = 6000;

// EPF rates
const EPF_RATES = {
  // Malaysian under 60
  malaysian_under60_low: { employer: 0.13, employee: 0.11 }, // wages ≤ RM5,000
  malaysian_under60_high: { employer: 0.12, employee: 0.11 }, // wages > RM5,000
  // Malaysian 60 and above
  malaysian_60plus: { employer: 0.04, employee: 0 },
  // Foreign workers (effective Oct 2025)
  foreign: { employer: 0.02, employee: 0.02 },
  // Permanent residents (same as Malaysian)
  pr_under60_low: { employer: 0.13, employee: 0.11 },
  pr_under60_high: { employer: 0.12, employee: 0.11 },
};

// SOCSO rates
const SOCSO_RATES = {
  // Category 1: Employment Injury + Invalidity (under 60)
  category1: { employer: 0.0175, employee: 0.005 },
  // Category 2: Employment Injury only (60 and above)
  category2: { employer: 0.0125, employee: 0 },
};

// EIS rate (fixed)
const EIS_RATE = 0.002; // 0.2% each

// PCB Tax Brackets (2024) - Monthly basis
const PCB_TAX_BRACKETS = [
  { min: 0, max: 5000, rate: 0 },
  { min: 5001, max: 20000, rate: 0.01 },
  { min: 20001, max: 35000, rate: 0.03 },
  { min: 35001, max: 50000, rate: 0.06 },
  { min: 50001, max: 70000, rate: 0.11 },
  { min: 70001, max: 100000, rate: 0.19 },
  { min: 100001, max: 400000, rate: 0.25 },
  { min: 400001, max: 600000, rate: 0.26 },
  { min: 600001, max: 2000000, rate: 0.28 },
  { min: 2000001, max: Infinity, rate: 0.30 },
];

// Annual tax reliefs (2024)
const TAX_RELIEFS = {
  personal: 9000,
  spouse_no_income: 4000,
  child_under_18: 2000,
  child_18_plus_studying: 8000,
  disabled_child: 6000,
  epf_max: 4000,
  socso_eis_max: 350,
  life_insurance_max: 3000,
  medical_insurance_max: 3000,
};

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface EmployeeStatutoryInfo {
  nationality: NationalityType;
  dateOfBirth: string | null;
  maritalStatus: MaritalStatus;
  spouseWorking: boolean;
  numberOfChildren: number;
  childrenInUniversity: number;
  disabledChildren: number;
  // Optional rate overrides
  epfEmployeeRate?: string | null;
  epfEmployerRate?: string | null;
}

export interface EPFResult {
  employeeContribution: string;
  employerContribution: string;
  applicableWage: string;
  employeeRate: string;
  employerRate: string;
}

export interface SOCSOResult {
  employeeContribution: string;
  employerContribution: string;
  applicableWage: string;
  category: "1" | "2";
}

export interface EISResult {
  employeeContribution: string;
  employerContribution: string;
  applicableWage: string;
  isApplicable: boolean;
}

export interface PCBResult {
  amount: string;
  taxableIncome: string;
  estimatedAnnualIncome: string;
  totalReliefs: string;
  annualTax: string;
  reliefs: {
    personal: string;
    spouse: string;
    children: string;
    epf: string;
    socsoEis: string;
  };
}

export interface StatutoryCalculationResult {
  epf: EPFResult;
  socso: SOCSOResult;
  eis: EISResult;
  pcb: PCBResult;
  totalEmployeeDeductions: string;
  totalEmployerContributions: string;
}

// ============================================================================
// EPF CALCULATION
// ============================================================================

/**
 * Calculate EPF contribution
 * - Malaysian/PR: 13%/12% employer, 11% employee (based on wage bracket)
 * - Malaysian/PR 60+: 4%/0% (employer only)
 * - Foreign: 2%/2% (from Oct 2025)
 */
export function calculateEPF(
  grossWage: number | string,
  employee: EmployeeStatutoryInfo
): EPFResult {
  const wage = new Decimal(grossWage);
  const age = calculateAge(employee.dateOfBirth);
  const isAbove60 = age >= 60;

  // Explicit nationality handling
  const isForeign = employee.nationality === "foreign";
  const isMalaysianOrPR = employee.nationality === "malaysian" || employee.nationality === "permanent_resident";

  // Apply wage ceiling (RM20,000)
  const applicableWage = Decimal.min(wage, EPF_WAGE_CEILING);

  let employerRate: Decimal;
  let employeeRate: Decimal;

  if (isForeign) {
    // Foreign workers: 2% each (effective Oct 2025)
    employerRate = new Decimal(EPF_RATES.foreign.employer);
    employeeRate = new Decimal(EPF_RATES.foreign.employee);
  } else if (isMalaysianOrPR && isAbove60) {
    // Malaysian/PR 60 and above: employer only (4%/0%)
    employerRate = new Decimal(EPF_RATES.malaysian_60plus.employer);
    employeeRate = new Decimal(EPF_RATES.malaysian_60plus.employee);
  } else if (isMalaysianOrPR && wage.lte(5000)) {
    // Malaysian/PR under 60, wages ≤ RM5,000: 13%/11%
    employerRate = new Decimal(EPF_RATES.malaysian_under60_low.employer);
    employeeRate = new Decimal(EPF_RATES.malaysian_under60_low.employee);
  } else if (isMalaysianOrPR) {
    // Malaysian/PR under 60, wages > RM5,000: 12%/11%
    employerRate = new Decimal(EPF_RATES.malaysian_under60_high.employer);
    employeeRate = new Decimal(EPF_RATES.malaysian_under60_high.employee);
  } else {
    // Fallback (shouldn't happen with valid nationality types)
    logger.warn({ nationality: employee.nationality }, "Unknown nationality type, using default rates");
    employerRate = new Decimal(EPF_RATES.malaysian_under60_high.employer);
    employeeRate = new Decimal(EPF_RATES.malaysian_under60_high.employee);
  }

  // Check for rate overrides
  if (employee.epfEmployerRate) {
    employerRate = new Decimal(employee.epfEmployerRate).div(100);
  }
  if (employee.epfEmployeeRate) {
    employeeRate = new Decimal(employee.epfEmployeeRate).div(100);
  }

  // Calculate contributions
  const employeeContribution = applicableWage.mul(employeeRate);
  const employerContribution = applicableWage.mul(employerRate);

  // Round to nearest RM (EPF standard)
  const roundedEmployeeContribution = roundToNearestRinggit(employeeContribution);
  const roundedEmployerContribution = roundToNearestRinggit(employerContribution);

  return {
    employeeContribution: roundedEmployeeContribution.toFixed(2),
    employerContribution: roundedEmployerContribution.toFixed(2),
    applicableWage: applicableWage.toFixed(2),
    employeeRate: employeeRate.mul(100).toFixed(2),
    employerRate: employerRate.mul(100).toFixed(2),
  };
}

// ============================================================================
// SOCSO CALCULATION
// ============================================================================

/**
 * Calculate SOCSO contribution
 * - Category 1 (Malaysian/PR under 60): Employer 1.75%, Employee 0.5%
 * - Category 2 (Malaysian/PR 60+): Employer 1.25%, Employee 0%
 * - Wage ceiling: RM6,000
 * - Foreign workers: Not covered by SOCSO
 */
export function calculateSOCSO(
  grossWage: number | string,
  employee: EmployeeStatutoryInfo
): SOCSOResult {
  const wage = new Decimal(grossWage);
  const age = calculateAge(employee.dateOfBirth);

  // Explicit nationality handling
  const isForeign = employee.nationality === "foreign";
  const isMalaysianOrPR = employee.nationality === "malaysian" || employee.nationality === "permanent_resident";

  // Foreign workers not covered by SOCSO
  if (isForeign || !isMalaysianOrPR) {
    return {
      employeeContribution: "0.00",
      employerContribution: "0.00",
      applicableWage: "0.00",
      category: "1",
    };
  }

  // Apply wage ceiling (RM6,000)
  const applicableWage = Decimal.min(wage, SOCSO_WAGE_CEILING);

  const isAbove60 = age >= 60;
  const category: "1" | "2" = isAbove60 ? "2" : "1";
  const rates = isAbove60 ? SOCSO_RATES.category2 : SOCSO_RATES.category1;

  const employeeContribution = applicableWage.mul(rates.employee);
  const employerContribution = applicableWage.mul(rates.employer);

  // Round to 2 decimal places
  return {
    employeeContribution: employeeContribution.toDecimalPlaces(2).toFixed(2),
    employerContribution: employerContribution.toDecimalPlaces(2).toFixed(2),
    applicableWage: applicableWage.toFixed(2),
    category,
  };
}

// ============================================================================
// EIS CALCULATION
// ============================================================================

/**
 * Calculate EIS contribution
 * - Both employer and employee: 0.2%
 * - Wage ceiling: RM6,000
 * - Malaysian citizens and PRs only (not foreign workers)
 * - Only applies to employees under 60 years old
 */
export function calculateEIS(
  grossWage: number | string,
  employee: EmployeeStatutoryInfo
): EISResult {
  const wage = new Decimal(grossWage);
  const age = calculateAge(employee.dateOfBirth);
  const isAbove60 = age >= 60;

  // Explicit nationality handling
  const isForeign = employee.nationality === "foreign";
  const isMalaysianOrPR = employee.nationality === "malaysian" || employee.nationality === "permanent_resident";

  // EIS only applies to Malaysian citizens/PRs under 60
  if (isForeign || !isMalaysianOrPR || isAbove60) {
    return {
      employeeContribution: "0.00",
      employerContribution: "0.00",
      applicableWage: "0.00",
      isApplicable: false,
    };
  }

  // Apply wage ceiling (RM6,000)
  const applicableWage = Decimal.min(wage, EIS_WAGE_CEILING);

  const contribution = applicableWage.mul(EIS_RATE);

  // Round to 2 decimal places
  const roundedContribution = contribution.toDecimalPlaces(2);

  return {
    employeeContribution: roundedContribution.toFixed(2),
    employerContribution: roundedContribution.toFixed(2),
    applicableWage: applicableWage.toFixed(2),
    isApplicable: true,
  };
}

// ============================================================================
// PCB (MONTHLY TAX DEDUCTION) CALCULATION
// ============================================================================

interface PCBInput {
  monthlyWage: number | string;
  ytdGross: number | string; // Year-to-date gross salary (excluding current month)
  ytdEpf: number | string; // Year-to-date EPF contributions
  ytdSocsoEis: number | string; // Year-to-date SOCSO + EIS contributions
  ytdPcb: number | string; // Year-to-date PCB paid
  currentMonth: number; // 1-12
  currentMonthSocso: number | string; // Current month SOCSO employee contribution
  currentMonthEis: number | string; // Current month EIS employee contribution
  employee: EmployeeStatutoryInfo;
}

/**
 * Calculate PCB (Monthly Tax Deduction)
 * Uses the formula-based approach from LHDN
 *
 * Steps:
 * 1. Calculate annual taxable income (annualize current month)
 * 2. Apply tax reliefs
 * 3. Calculate annual tax
 * 4. Prorate for remaining months
 * 5. Subtract YTD PCB already paid
 */
export function calculatePCB(input: PCBInput): PCBResult {
  const {
    monthlyWage,
    ytdGross,
    ytdEpf,
    ytdSocsoEis,
    ytdPcb,
    currentMonth,
    currentMonthSocso,
    currentMonthEis,
    employee,
  } = input;

  const wage = new Decimal(monthlyWage);
  const ytdGrossAmount = new Decimal(ytdGross);
  const ytdEpfAmount = new Decimal(ytdEpf);
  const ytdSocsoEisAmount = new Decimal(ytdSocsoEis);
  const ytdPcbAmount = new Decimal(ytdPcb);
  const currentSocso = new Decimal(currentMonthSocso);
  const currentEis = new Decimal(currentMonthEis);
  const remainingMonths = 12 - currentMonth + 1;

  // Foreign workers - simplified withholding at flat rate (typically 28%)
  if (employee.nationality === "foreign") {
    const taxAmount = wage.mul(0.28);
    return {
      amount: taxAmount.toDecimalPlaces(2).toFixed(2),
      taxableIncome: wage.mul(12).toFixed(2), // Annualized
      estimatedAnnualIncome: wage.mul(12).toFixed(2),
      totalReliefs: "0.00",
      annualTax: taxAmount.mul(12).toFixed(2),
      reliefs: {
        personal: "0.00",
        spouse: "0.00",
        children: "0.00",
        epf: "0.00",
        socsoEis: "0.00",
      },
    };
  }

  // Step 1: Calculate estimated annual income
  // Current year income = YTD + (monthly wage × remaining months)
  const estimatedAnnualIncome = ytdGrossAmount.add(wage.mul(remainingMonths));

  // Step 2: Calculate tax reliefs
  let totalReliefs = new Decimal(TAX_RELIEFS.personal);

  // Spouse relief (if married and spouse not working)
  const spouseRelief = employee.maritalStatus === "married" && !employee.spouseWorking
    ? TAX_RELIEFS.spouse_no_income
    : 0;
  totalReliefs = totalReliefs.add(spouseRelief);

  // Children relief
  const childrenUnder18 = Math.max(0, employee.numberOfChildren - employee.childrenInUniversity - employee.disabledChildren);
  const childrenRelief =
    (childrenUnder18 * TAX_RELIEFS.child_under_18) +
    (employee.childrenInUniversity * TAX_RELIEFS.child_18_plus_studying) +
    (employee.disabledChildren * TAX_RELIEFS.disabled_child);
  totalReliefs = totalReliefs.add(childrenRelief);

  // EPF relief (capped at RM4,000 annually)
  // Estimate annual EPF based on YTD + remaining months at 11%
  const estimatedAnnualEpf = ytdEpfAmount.add(
    new Decimal(monthlyWage).mul(0.11).mul(remainingMonths)
  );
  const epfRelief = Decimal.min(estimatedAnnualEpf, TAX_RELIEFS.epf_max);
  totalReliefs = totalReliefs.add(epfRelief);

  // SOCSO + EIS relief (capped at RM350 annually)
  // Calculate estimated annual SOCSO+EIS based on YTD + remaining months
  const currentMonthSocsoEis = currentSocso.add(currentEis);
  const estimatedAnnualSocsoEis = ytdSocsoEisAmount.add(
    currentMonthSocsoEis.mul(remainingMonths)
  );
  const socsoEisRelief = Decimal.min(estimatedAnnualSocsoEis, TAX_RELIEFS.socso_eis_max);
  totalReliefs = totalReliefs.add(socsoEisRelief);

  // Step 3: Calculate taxable income
  const taxableIncome = Decimal.max(estimatedAnnualIncome.sub(totalReliefs), 0);

  // Step 4: Calculate annual tax using progressive brackets
  const annualTax = calculateProgressiveTax(taxableIncome);

  // Step 5: Calculate monthly PCB
  // PCB = (Annual Tax - YTD PCB) / Remaining Months
  const remainingTax = Decimal.max(annualTax.sub(ytdPcbAmount), 0);
  const monthlyPcb = remainingTax.div(remainingMonths);

  // Ensure non-negative
  const finalPcb = Decimal.max(monthlyPcb, 0).toDecimalPlaces(2);

  logger.info({
    monthlyWage: wage.toFixed(2),
    estimatedAnnualIncome: estimatedAnnualIncome.toFixed(2),
    totalReliefs: totalReliefs.toFixed(2),
    taxableIncome: taxableIncome.toFixed(2),
    annualTax: annualTax.toFixed(2),
    remainingMonths,
    ytdPcb: ytdPcbAmount.toFixed(2),
    monthlyPcb: finalPcb.toFixed(2),
    epfRelief: epfRelief.toFixed(2),
    socsoEisRelief: socsoEisRelief.toFixed(2),
  }, "PCB calculation");

  return {
    amount: finalPcb.toFixed(2),
    taxableIncome: taxableIncome.toFixed(2),
    estimatedAnnualIncome: estimatedAnnualIncome.toFixed(2),
    totalReliefs: totalReliefs.toFixed(2),
    annualTax: annualTax.toFixed(2),
    reliefs: {
      personal: TAX_RELIEFS.personal.toString(),
      spouse: spouseRelief.toString(),
      children: childrenRelief.toString(),
      epf: epfRelief.toFixed(2),
      socsoEis: socsoEisRelief.toFixed(2),
    },
  };
}

/**
 * Calculate progressive tax based on Malaysian tax brackets
 */
function calculateProgressiveTax(annualTaxableIncome: Decimal): Decimal {
  let tax = new Decimal(0);
  let remainingIncome = annualTaxableIncome;

  for (const bracket of PCB_TAX_BRACKETS) {
    if (remainingIncome.lte(0)) break;

    const bracketSize = bracket.max === Infinity
      ? remainingIncome
      : new Decimal(bracket.max - bracket.min);

    const taxableInBracket = Decimal.min(remainingIncome, bracketSize);
    tax = tax.add(taxableInBracket.mul(bracket.rate));
    remainingIncome = remainingIncome.sub(taxableInBracket);
  }

  return tax;
}

// ============================================================================
// COMBINED CALCULATION
// ============================================================================

interface AllStatutoryInput {
  grossWage: number | string;
  employee: EmployeeStatutoryInfo;
  currentMonth: number;
  ytdGross?: number | string;
  ytdEpf?: number | string;
  ytdSocsoEis?: number | string;
  ytdPcb?: number | string;
}

/**
 * Calculate all statutory contributions for an employee
 */
export function calculateAllStatutory(input: AllStatutoryInput): StatutoryCalculationResult {
  const {
    grossWage,
    employee,
    currentMonth,
    ytdGross = "0",
    ytdEpf = "0",
    ytdSocsoEis = "0",
    ytdPcb = "0",
  } = input;

  // Calculate EPF
  const epf = calculateEPF(grossWage, employee);

  // Calculate SOCSO
  const socso = calculateSOCSO(grossWage, employee);

  // Calculate EIS
  const eis = calculateEIS(grossWage, employee);

  // Calculate PCB with SOCSO/EIS for relief calculation
  const pcb = calculatePCB({
    monthlyWage: grossWage,
    ytdGross,
    ytdEpf,
    ytdSocsoEis,
    ytdPcb,
    currentMonth,
    currentMonthSocso: socso.employeeContribution,
    currentMonthEis: eis.employeeContribution,
    employee,
  });

  // Calculate totals
  const totalEmployeeDeductions = new Decimal(epf.employeeContribution)
    .add(socso.employeeContribution)
    .add(eis.employeeContribution)
    .add(pcb.amount);

  const totalEmployerContributions = new Decimal(epf.employerContribution)
    .add(socso.employerContribution)
    .add(eis.employerContribution);

  return {
    epf,
    socso,
    eis,
    pcb,
    totalEmployeeDeductions: totalEmployeeDeductions.toFixed(2),
    totalEmployerContributions: totalEmployerContributions.toFixed(2),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string | null): number {
  if (!dateOfBirth) return 30; // Default to under 60 if unknown

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Round to nearest RM (EPF standard rounding)
 */
function roundToNearestRinggit(amount: Decimal): Decimal {
  return amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/**
 * Get statutory wage ceilings
 */
export function getStatutoryWageCeilings() {
  return {
    epf: EPF_WAGE_CEILING,
    socso: SOCSO_WAGE_CEILING,
    eis: EIS_WAGE_CEILING,
  };
}

/**
 * Get applicable EPF rates for employee
 */
export function getEPFRates(employee: EmployeeStatutoryInfo, grossWage: number): {
  employerRate: number;
  employeeRate: number;
} {
  const age = calculateAge(employee.dateOfBirth);
  const isForeign = employee.nationality === "foreign";
  const isAbove60 = age >= 60;

  let rates: { employer: number; employee: number };

  if (isForeign) {
    rates = EPF_RATES.foreign;
  } else if (isAbove60) {
    rates = EPF_RATES.malaysian_60plus;
  } else if (grossWage <= 5000) {
    rates = EPF_RATES.malaysian_under60_low;
  } else {
    rates = EPF_RATES.malaysian_under60_high;
  }

  return {
    employerRate: rates.employer,
    employeeRate: rates.employee,
  };
}
