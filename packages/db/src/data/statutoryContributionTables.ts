/**
 * Malaysian Statutory Contribution Tables
 *
 * EPF (KWSP): Employees Provident Fund
 * - Table-based for wages < RM20,000
 * - Percentage-based for wages >= RM20,000
 * - Employer: 12% (wages > RM5,000) or 13% (wages <= RM5,000) for Malaysian < 60
 * - Employee: 11% for Malaysian
 * - Foreign workers: 2%/2% (effective Oct 2025)
 *
 * SOCSO (PERKESO): Social Security Organization
 * - Capped at RM6,000 wage ceiling (effective Oct 2024)
 * - Category 1 (< 60): Employer 1.75%, Employee 0.5%
 * - Category 2 (>= 60): Employer 1.25%, Employee 0%
 *
 * EIS (SIP): Employment Insurance System
 * - Capped at RM6,000 wage ceiling
 * - Both employer and employee: 0.2%
 * - Malaysian citizens only
 *
 * Sources:
 * - KWSP: https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution
 * - PERKESO: https://www.perkeso.gov.my/en/rate-of-contribution.html
 * - EIS: https://www.eis.gov.my/
 */

import type { StatutoryContributionType } from "../schema/payroll";

export interface StatutoryContributionEntry {
  contributionType: StatutoryContributionType;
  effectiveFrom: string; // ISO date string
  effectiveTo: string | null; // null = currently active
  wageFrom: string;
  wageTo: string;
  contributionAmount: string | null;
  contributionRate: string | null;
  conditions: {
    ageCategory?: "under_60" | "60_and_above";
    nationality?: "malaysian" | "permanent_resident" | "foreign";
    salaryCategory?: "5000_and_below" | "above_5000";
  } | null;
}

// EPF employer rates - Malaysian under 60, wages RM5,000 and below (13%)
// Using simplified ranges - in production, use full KWSP tables
export const epfEmployerMalaysianUnder60Low: StatutoryContributionEntry[] = [
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "30", contributionAmount: "5", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "30.01", wageTo: "50", contributionAmount: "7", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "50.01", wageTo: "70", contributionAmount: "10", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "70.01", wageTo: "100", contributionAmount: "13", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "100.01", wageTo: "140", contributionAmount: "18", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "140.01", wageTo: "200", contributionAmount: "26", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "200.01", wageTo: "300", contributionAmount: "39", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "300.01", wageTo: "400", contributionAmount: "52", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "400.01", wageTo: "500", contributionAmount: "65", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "500.01", wageTo: "600", contributionAmount: "78", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "600.01", wageTo: "700", contributionAmount: "91", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "700.01", wageTo: "800", contributionAmount: "104", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "800.01", wageTo: "900", contributionAmount: "117", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "900.01", wageTo: "1000", contributionAmount: "130", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1000.01", wageTo: "1100", contributionAmount: "143", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1100.01", wageTo: "1200", contributionAmount: "156", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1200.01", wageTo: "1300", contributionAmount: "169", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1300.01", wageTo: "1400", contributionAmount: "182", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1400.01", wageTo: "1500", contributionAmount: "195", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1500.01", wageTo: "1600", contributionAmount: "208", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1600.01", wageTo: "1700", contributionAmount: "221", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1700.01", wageTo: "1800", contributionAmount: "234", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1800.01", wageTo: "1900", contributionAmount: "247", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1900.01", wageTo: "2000", contributionAmount: "260", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2000.01", wageTo: "2100", contributionAmount: "273", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2100.01", wageTo: "2200", contributionAmount: "286", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2200.01", wageTo: "2300", contributionAmount: "299", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2300.01", wageTo: "2400", contributionAmount: "312", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2400.01", wageTo: "2500", contributionAmount: "325", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2500.01", wageTo: "2600", contributionAmount: "338", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2600.01", wageTo: "2700", contributionAmount: "351", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2700.01", wageTo: "2800", contributionAmount: "364", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2800.01", wageTo: "2900", contributionAmount: "377", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2900.01", wageTo: "3000", contributionAmount: "390", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3000.01", wageTo: "3100", contributionAmount: "403", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3100.01", wageTo: "3200", contributionAmount: "416", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3200.01", wageTo: "3300", contributionAmount: "429", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3300.01", wageTo: "3400", contributionAmount: "442", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3400.01", wageTo: "3500", contributionAmount: "455", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3500.01", wageTo: "3600", contributionAmount: "468", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3600.01", wageTo: "3700", contributionAmount: "481", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3700.01", wageTo: "3800", contributionAmount: "494", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3800.01", wageTo: "3900", contributionAmount: "507", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3900.01", wageTo: "4000", contributionAmount: "520", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4000.01", wageTo: "4100", contributionAmount: "533", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4100.01", wageTo: "4200", contributionAmount: "546", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4200.01", wageTo: "4300", contributionAmount: "559", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4300.01", wageTo: "4400", contributionAmount: "572", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4400.01", wageTo: "4500", contributionAmount: "585", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4500.01", wageTo: "4600", contributionAmount: "598", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4600.01", wageTo: "4700", contributionAmount: "611", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4700.01", wageTo: "4800", contributionAmount: "624", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4800.01", wageTo: "4900", contributionAmount: "637", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4900.01", wageTo: "5000", contributionAmount: "650", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "5000_and_below" } },
];

// EPF employee rates - Malaysian under 60 (11%)
export const epfEmployeeMalaysianUnder60: StatutoryContributionEntry[] = [
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "30", contributionAmount: "0", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "30.01", wageTo: "50", contributionAmount: "5", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "50.01", wageTo: "70", contributionAmount: "6", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "70.01", wageTo: "100", contributionAmount: "9", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "100.01", wageTo: "140", contributionAmount: "13", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "140.01", wageTo: "200", contributionAmount: "18", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "200.01", wageTo: "300", contributionAmount: "28", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "300.01", wageTo: "400", contributionAmount: "39", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "400.01", wageTo: "500", contributionAmount: "50", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "500.01", wageTo: "600", contributionAmount: "61", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "600.01", wageTo: "700", contributionAmount: "72", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "700.01", wageTo: "800", contributionAmount: "83", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "800.01", wageTo: "900", contributionAmount: "94", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "900.01", wageTo: "1000", contributionAmount: "105", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1000.01", wageTo: "1100", contributionAmount: "116", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1100.01", wageTo: "1200", contributionAmount: "127", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1200.01", wageTo: "1300", contributionAmount: "138", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1300.01", wageTo: "1400", contributionAmount: "149", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1400.01", wageTo: "1500", contributionAmount: "160", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1500.01", wageTo: "1600", contributionAmount: "171", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1600.01", wageTo: "1700", contributionAmount: "182", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1700.01", wageTo: "1800", contributionAmount: "193", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1800.01", wageTo: "1900", contributionAmount: "204", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "1900.01", wageTo: "2000", contributionAmount: "215", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2000.01", wageTo: "2100", contributionAmount: "226", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2100.01", wageTo: "2200", contributionAmount: "237", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2200.01", wageTo: "2300", contributionAmount: "248", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2300.01", wageTo: "2400", contributionAmount: "259", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2400.01", wageTo: "2500", contributionAmount: "270", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2500.01", wageTo: "2600", contributionAmount: "281", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2600.01", wageTo: "2700", contributionAmount: "292", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2700.01", wageTo: "2800", contributionAmount: "303", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2800.01", wageTo: "2900", contributionAmount: "314", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "2900.01", wageTo: "3000", contributionAmount: "325", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3000.01", wageTo: "3100", contributionAmount: "336", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3100.01", wageTo: "3200", contributionAmount: "347", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3200.01", wageTo: "3300", contributionAmount: "358", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3300.01", wageTo: "3400", contributionAmount: "369", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3400.01", wageTo: "3500", contributionAmount: "380", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3500.01", wageTo: "3600", contributionAmount: "391", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3600.01", wageTo: "3700", contributionAmount: "402", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3700.01", wageTo: "3800", contributionAmount: "413", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3800.01", wageTo: "3900", contributionAmount: "424", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "3900.01", wageTo: "4000", contributionAmount: "435", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4000.01", wageTo: "4100", contributionAmount: "446", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4100.01", wageTo: "4200", contributionAmount: "457", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4200.01", wageTo: "4300", contributionAmount: "468", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4300.01", wageTo: "4400", contributionAmount: "479", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4400.01", wageTo: "4500", contributionAmount: "490", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4500.01", wageTo: "4600", contributionAmount: "501", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4600.01", wageTo: "4700", contributionAmount: "512", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4700.01", wageTo: "4800", contributionAmount: "523", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4800.01", wageTo: "4900", contributionAmount: "534", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "4900.01", wageTo: "5000", contributionAmount: "545", contributionRate: null, conditions: { ageCategory: "under_60", nationality: "malaysian" } },
];

// For wages above RM5,000 (up to RM20,000), use percentage-based calculation
// Employer: 12% for wages > RM5,000
// Employee: 11%
export const epfPercentageRates: StatutoryContributionEntry[] = [
  // Malaysian under 60, wages above RM5,000
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "5000.01", wageTo: "20000", contributionAmount: null, contributionRate: "0.12", conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "above_5000" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "5000.01", wageTo: "20000", contributionAmount: null, contributionRate: "0.11", conditions: { ageCategory: "under_60", nationality: "malaysian", salaryCategory: "above_5000" } },

  // Malaysian 60 and above (employer only, reduced rate)
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "20000", contributionAmount: null, contributionRate: "0.04", conditions: { ageCategory: "60_and_above", nationality: "malaysian" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "20000", contributionAmount: null, contributionRate: "0", conditions: { ageCategory: "60_and_above", nationality: "malaysian" } },

  // Foreign workers (effective Oct 2025)
  { contributionType: "epf_employer", effectiveFrom: "2025-10-01", effectiveTo: null, wageFrom: "0", wageTo: "20000", contributionAmount: null, contributionRate: "0.02", conditions: { nationality: "foreign" } },
  { contributionType: "epf_employee", effectiveFrom: "2025-10-01", effectiveTo: null, wageFrom: "0", wageTo: "20000", contributionAmount: null, contributionRate: "0.02", conditions: { nationality: "foreign" } },

  // Permanent residents (same as Malaysian)
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "5000", contributionAmount: null, contributionRate: "0.13", conditions: { ageCategory: "under_60", nationality: "permanent_resident", salaryCategory: "5000_and_below" } },
  { contributionType: "epf_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "5000.01", wageTo: "20000", contributionAmount: null, contributionRate: "0.12", conditions: { ageCategory: "under_60", nationality: "permanent_resident", salaryCategory: "above_5000" } },
  { contributionType: "epf_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "20000", contributionAmount: null, contributionRate: "0.11", conditions: { ageCategory: "under_60", nationality: "permanent_resident" } },
];

// SOCSO (PERKESO) contribution table - effective Oct 2024, ceiling RM6,000
// Category 1: Employment Injury + Invalidity (under 60)
// Category 2: Employment Injury only (60 and above)
export const socsoContributionTable: StatutoryContributionEntry[] = [
  // Category 1 - Under 60 (Employer 1.75%, Employee 0.5%)
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "0", wageTo: "30", contributionAmount: "0.40", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "0", wageTo: "30", contributionAmount: "0.10", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "30.01", wageTo: "50", contributionAmount: "0.70", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "30.01", wageTo: "50", contributionAmount: "0.20", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "50.01", wageTo: "70", contributionAmount: "1.10", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "50.01", wageTo: "70", contributionAmount: "0.30", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "70.01", wageTo: "100", contributionAmount: "1.50", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "70.01", wageTo: "100", contributionAmount: "0.40", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "100.01", wageTo: "140", contributionAmount: "2.10", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "100.01", wageTo: "140", contributionAmount: "0.60", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "140.01", wageTo: "200", contributionAmount: "2.95", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "140.01", wageTo: "200", contributionAmount: "0.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "200.01", wageTo: "300", contributionAmount: "4.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "200.01", wageTo: "300", contributionAmount: "1.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "300.01", wageTo: "400", contributionAmount: "6.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "300.01", wageTo: "400", contributionAmount: "1.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "400.01", wageTo: "500", contributionAmount: "7.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "400.01", wageTo: "500", contributionAmount: "2.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "500.01", wageTo: "600", contributionAmount: "9.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "500.01", wageTo: "600", contributionAmount: "2.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "600.01", wageTo: "700", contributionAmount: "11.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "600.01", wageTo: "700", contributionAmount: "3.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "700.01", wageTo: "800", contributionAmount: "13.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "700.01", wageTo: "800", contributionAmount: "3.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "800.01", wageTo: "900", contributionAmount: "14.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "800.01", wageTo: "900", contributionAmount: "4.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "900.01", wageTo: "1000", contributionAmount: "16.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "900.01", wageTo: "1000", contributionAmount: "4.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1000.01", wageTo: "1100", contributionAmount: "18.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1000.01", wageTo: "1100", contributionAmount: "5.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1100.01", wageTo: "1200", contributionAmount: "20.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1100.01", wageTo: "1200", contributionAmount: "5.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1200.01", wageTo: "1300", contributionAmount: "21.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1200.01", wageTo: "1300", contributionAmount: "6.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1300.01", wageTo: "1400", contributionAmount: "23.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1300.01", wageTo: "1400", contributionAmount: "6.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1400.01", wageTo: "1500", contributionAmount: "25.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1400.01", wageTo: "1500", contributionAmount: "7.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1500.01", wageTo: "1600", contributionAmount: "27.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1500.01", wageTo: "1600", contributionAmount: "7.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1600.01", wageTo: "1700", contributionAmount: "28.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1600.01", wageTo: "1700", contributionAmount: "8.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1700.01", wageTo: "1800", contributionAmount: "30.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1700.01", wageTo: "1800", contributionAmount: "8.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1800.01", wageTo: "1900", contributionAmount: "32.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1800.01", wageTo: "1900", contributionAmount: "9.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1900.01", wageTo: "2000", contributionAmount: "34.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "1900.01", wageTo: "2000", contributionAmount: "9.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2000.01", wageTo: "2100", contributionAmount: "35.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2000.01", wageTo: "2100", contributionAmount: "10.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2100.01", wageTo: "2200", contributionAmount: "37.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2100.01", wageTo: "2200", contributionAmount: "10.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2200.01", wageTo: "2300", contributionAmount: "39.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2200.01", wageTo: "2300", contributionAmount: "11.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2300.01", wageTo: "2400", contributionAmount: "41.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2300.01", wageTo: "2400", contributionAmount: "11.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2400.01", wageTo: "2500", contributionAmount: "42.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2400.01", wageTo: "2500", contributionAmount: "12.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2500.01", wageTo: "2600", contributionAmount: "44.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2500.01", wageTo: "2600", contributionAmount: "12.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2600.01", wageTo: "2700", contributionAmount: "46.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2600.01", wageTo: "2700", contributionAmount: "13.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2700.01", wageTo: "2800", contributionAmount: "48.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2700.01", wageTo: "2800", contributionAmount: "13.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2800.01", wageTo: "2900", contributionAmount: "49.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2800.01", wageTo: "2900", contributionAmount: "14.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2900.01", wageTo: "3000", contributionAmount: "51.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "2900.01", wageTo: "3000", contributionAmount: "14.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3000.01", wageTo: "3100", contributionAmount: "53.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3000.01", wageTo: "3100", contributionAmount: "15.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3100.01", wageTo: "3200", contributionAmount: "55.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3100.01", wageTo: "3200", contributionAmount: "15.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3200.01", wageTo: "3300", contributionAmount: "56.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3200.01", wageTo: "3300", contributionAmount: "16.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3300.01", wageTo: "3400", contributionAmount: "58.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3300.01", wageTo: "3400", contributionAmount: "16.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3400.01", wageTo: "3500", contributionAmount: "60.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3400.01", wageTo: "3500", contributionAmount: "17.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3500.01", wageTo: "3600", contributionAmount: "62.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3500.01", wageTo: "3600", contributionAmount: "17.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3600.01", wageTo: "3700", contributionAmount: "63.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3600.01", wageTo: "3700", contributionAmount: "18.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3700.01", wageTo: "3800", contributionAmount: "65.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3700.01", wageTo: "3800", contributionAmount: "18.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3800.01", wageTo: "3900", contributionAmount: "67.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3800.01", wageTo: "3900", contributionAmount: "19.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3900.01", wageTo: "4000", contributionAmount: "69.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "3900.01", wageTo: "4000", contributionAmount: "19.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4000.01", wageTo: "4100", contributionAmount: "70.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4000.01", wageTo: "4100", contributionAmount: "20.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4100.01", wageTo: "4200", contributionAmount: "72.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4100.01", wageTo: "4200", contributionAmount: "20.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4200.01", wageTo: "4300", contributionAmount: "74.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4200.01", wageTo: "4300", contributionAmount: "21.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4300.01", wageTo: "4400", contributionAmount: "76.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4300.01", wageTo: "4400", contributionAmount: "21.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4400.01", wageTo: "4500", contributionAmount: "77.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4400.01", wageTo: "4500", contributionAmount: "22.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4500.01", wageTo: "4600", contributionAmount: "79.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4500.01", wageTo: "4600", contributionAmount: "22.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4600.01", wageTo: "4700", contributionAmount: "81.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4600.01", wageTo: "4700", contributionAmount: "23.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4700.01", wageTo: "4800", contributionAmount: "83.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4700.01", wageTo: "4800", contributionAmount: "23.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4800.01", wageTo: "4900", contributionAmount: "84.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4800.01", wageTo: "4900", contributionAmount: "24.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4900.01", wageTo: "5000", contributionAmount: "86.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "4900.01", wageTo: "5000", contributionAmount: "24.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5000.01", wageTo: "5100", contributionAmount: "88.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5000.01", wageTo: "5100", contributionAmount: "25.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5100.01", wageTo: "5200", contributionAmount: "90.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5100.01", wageTo: "5200", contributionAmount: "25.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5200.01", wageTo: "5300", contributionAmount: "91.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5200.01", wageTo: "5300", contributionAmount: "26.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5300.01", wageTo: "5400", contributionAmount: "93.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5300.01", wageTo: "5400", contributionAmount: "26.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5400.01", wageTo: "5500", contributionAmount: "95.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5400.01", wageTo: "5500", contributionAmount: "27.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5500.01", wageTo: "5600", contributionAmount: "97.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5500.01", wageTo: "5600", contributionAmount: "27.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5600.01", wageTo: "5700", contributionAmount: "98.85", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5600.01", wageTo: "5700", contributionAmount: "28.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5700.01", wageTo: "5800", contributionAmount: "100.65", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5700.01", wageTo: "5800", contributionAmount: "28.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5800.01", wageTo: "5900", contributionAmount: "102.35", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5800.01", wageTo: "5900", contributionAmount: "29.25", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5900.01", wageTo: "6000", contributionAmount: "104.15", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "5900.01", wageTo: "6000", contributionAmount: "29.75", contributionRate: null, conditions: { ageCategory: "under_60" } },
  // Ceiling at RM6,000
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "6000.01", wageTo: "999999", contributionAmount: "105", contributionRate: null, conditions: { ageCategory: "under_60" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "6000.01", wageTo: "999999", contributionAmount: "30", contributionRate: null, conditions: { ageCategory: "under_60" } },

  // Category 2 - 60 and above (Employer only, Employment Injury only: 1.25%)
  { contributionType: "socso_employer", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "0", wageTo: "6000", contributionAmount: null, contributionRate: "0.0125", conditions: { ageCategory: "60_and_above" } },
  { contributionType: "socso_employee", effectiveFrom: "2024-10-01", effectiveTo: null, wageFrom: "0", wageTo: "999999", contributionAmount: "0", contributionRate: "0", conditions: { ageCategory: "60_and_above" } },
];

// EIS (SIP) contribution - 0.2% each, capped at RM6,000, Malaysian only
export const eisContributionTable: StatutoryContributionEntry[] = [
  // Simple percentage-based (0.2% each)
  { contributionType: "eis_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "6000", contributionAmount: null, contributionRate: "0.002", conditions: { nationality: "malaysian" } },
  { contributionType: "eis_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "6000", contributionAmount: null, contributionRate: "0.002", conditions: { nationality: "malaysian" } },
  // Ceiling at RM6,000 (max RM12 each)
  { contributionType: "eis_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "6000.01", wageTo: "999999", contributionAmount: "12", contributionRate: null, conditions: { nationality: "malaysian" } },
  { contributionType: "eis_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "6000.01", wageTo: "999999", contributionAmount: "12", contributionRate: null, conditions: { nationality: "malaysian" } },
  // Foreign workers - no EIS
  { contributionType: "eis_employer", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "999999", contributionAmount: "0", contributionRate: "0", conditions: { nationality: "foreign" } },
  { contributionType: "eis_employee", effectiveFrom: "2024-01-01", effectiveTo: null, wageFrom: "0", wageTo: "999999", contributionAmount: "0", contributionRate: "0", conditions: { nationality: "foreign" } },
];

// Combine all tables
export const allStatutoryContributionTables: StatutoryContributionEntry[] = [
  ...epfEmployerMalaysianUnder60Low,
  ...epfEmployeeMalaysianUnder60,
  ...epfPercentageRates,
  ...socsoContributionTable,
  ...eisContributionTable,
];

// Helper functions
export function getStatutoryWageCeiling(type: "epf" | "socso" | "eis"): number {
  switch (type) {
    case "epf":
      return 20000;
    case "socso":
      return 6000;
    case "eis":
      return 6000;
  }
}

export function isMalaysianCitizen(nationality: string): boolean {
  return nationality === "malaysian" || nationality === "permanent_resident";
}
