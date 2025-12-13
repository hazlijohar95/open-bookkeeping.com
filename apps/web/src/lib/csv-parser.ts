/**
 * CSV Parser Utilities
 * Uses papaparse for robust CSV parsing with validation
 */

import Papa from "papaparse";

export interface ParseResult<T> {
  data: T[];
  errors: ParseError[];
  meta: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

export interface ParseError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

export interface ColumnMapping {
  csvColumn: string;
  targetField: string;
  required: boolean;
  transform?: (value: string) => unknown;
  validate?: (value: string) => string | null; // Returns error message or null if valid
}

/**
 * Parse CSV file and return raw data
 */
export function parseCSVFile(file: File): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (results) => resolve(results),
      error: (error) => reject(error),
    });
  });
}

/**
 * Parse CSV string and return raw data
 */
export function parseCSVString(csvString: string): Papa.ParseResult<Record<string, string>> {
  return Papa.parse<Record<string, string>>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
  });
}

/**
 * Map CSV data to target format with validation
 */
export function mapCSVData<T>(
  rawData: Record<string, string>[],
  mappings: ColumnMapping[]
): ParseResult<T> {
  const data: T[] = [];
  const errors: ParseError[] = [];
  let validRows = 0;
  let invalidRows = 0;

  rawData.forEach((row, rowIndex) => {
    const mappedRow: Record<string, unknown> = {};
    let rowValid = true;

    // Check each mapping
    for (const mapping of mappings) {
      const rawValue = row[mapping.csvColumn] ?? "";
      const trimmedValue = rawValue.trim();

      // Check required fields
      if (mapping.required && !trimmedValue) {
        errors.push({
          row: rowIndex + 2, // +2 for header row and 0-based index
          field: mapping.targetField,
          message: `${mapping.targetField} is required`,
        });
        rowValid = false;
        continue;
      }

      // Validate if validator provided
      if (mapping.validate && trimmedValue) {
        const validationError = mapping.validate(trimmedValue);
        if (validationError) {
          errors.push({
            row: rowIndex + 2,
            field: mapping.targetField,
            message: validationError,
            value: trimmedValue,
          });
          rowValid = false;
          continue;
        }
      }

      // Transform value
      if (mapping.transform && trimmedValue) {
        mappedRow[mapping.targetField] = mapping.transform(trimmedValue);
      } else {
        mappedRow[mapping.targetField] = trimmedValue;
      }
    }

    if (rowValid) {
      data.push(mappedRow as T);
      validRows++;
    } else {
      invalidRows++;
    }
  });

  return {
    data,
    errors,
    meta: {
      totalRows: rawData.length,
      validRows,
      invalidRows,
    },
  };
}

// ============================================================================
// Validators
// ============================================================================

export const validators = {
  number: (value: string): string | null => {
    const num = parseFloat(value.replace(/[,\s]/g, ""));
    if (isNaN(num)) {
      return "Must be a valid number";
    }
    return null;
  },

  positiveNumber: (value: string): string | null => {
    const num = parseFloat(value.replace(/[,\s]/g, ""));
    if (isNaN(num)) {
      return "Must be a valid number";
    }
    if (num < 0) {
      return "Must be a positive number";
    }
    return null;
  },

  date: (value: string): string | null => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return "Must be a valid date (YYYY-MM-DD)";
    }
    return null;
  },

  email: (value: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return "Must be a valid email address";
    }
    return null;
  },

  accountType: (value: string): string | null => {
    const validTypes = ["asset", "liability", "equity", "revenue", "expense"];
    if (!validTypes.includes(value.toLowerCase())) {
      return `Must be one of: ${validTypes.join(", ")}`;
    }
    return null;
  },
};

// ============================================================================
// Transformers
// ============================================================================

export const transformers = {
  toNumber: (value: string): number => {
    return parseFloat(value.replace(/[,\s]/g, "")) || 0;
  },

  toDecimalString: (value: string): string => {
    const num = parseFloat(value.replace(/[,\s]/g, "")) || 0;
    return num.toFixed(2);
  },

  toDate: (value: string): string => {
    const date = new Date(value);
    return date.toISOString().split("T")[0] ?? value;
  },

  toLowerCase: (value: string): string => {
    return value.toLowerCase();
  },

  toUpperCase: (value: string): string => {
    return value.toUpperCase();
  },

  trim: (value: string): string => {
    return value.trim();
  },
};

// ============================================================================
// Template Definitions for Different Import Types
// ============================================================================

export interface OpeningBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitAmount: string;
  creditAmount: string;
}

export const openingBalanceMappings: ColumnMapping[] = [
  {
    csvColumn: "account_code",
    targetField: "accountCode",
    required: true,
  },
  {
    csvColumn: "account_name",
    targetField: "accountName",
    required: true,
  },
  {
    csvColumn: "account_type",
    targetField: "accountType",
    required: true,
    validate: validators.accountType,
    transform: transformers.toLowerCase,
  },
  {
    csvColumn: "debit",
    targetField: "debitAmount",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "credit",
    targetField: "creditAmount",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
];

export interface PayrollYtdRow {
  employeeId: string;
  employeeCode: string; // For display/reference only
  employeeName: string; // For display/reference only
  asOfDate: string;
  monthsWorked: string;
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
}

export const payrollYtdMappings: ColumnMapping[] = [
  {
    csvColumn: "employee_id",
    targetField: "employeeId",
    required: true,
  },
  {
    csvColumn: "employee_code",
    targetField: "employeeCode",
    required: false,
  },
  {
    csvColumn: "employee_name",
    targetField: "employeeName",
    required: false,
  },
  {
    csvColumn: "as_of_date",
    targetField: "asOfDate",
    required: true,
    validate: validators.date,
    transform: transformers.toDate,
  },
  {
    csvColumn: "months_worked",
    targetField: "monthsWorked",
    required: true,
    validate: validators.positiveNumber,
  },
  {
    csvColumn: "ytd_gross_salary",
    targetField: "ytdGrossSalary",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_base_salary",
    targetField: "ytdBaseSalary",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_allowances",
    targetField: "ytdAllowances",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_other_earnings",
    targetField: "ytdOtherEarnings",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_total_deductions",
    targetField: "ytdTotalDeductions",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_other_deductions",
    targetField: "ytdOtherDeductions",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_epf_employee",
    targetField: "ytdEpfEmployee",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_socso_employee",
    targetField: "ytdSocsoEmployee",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_eis_employee",
    targetField: "ytdEisEmployee",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_pcb",
    targetField: "ytdPcb",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_epf_employer",
    targetField: "ytdEpfEmployer",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_socso_employer",
    targetField: "ytdSocsoEmployer",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_eis_employer",
    targetField: "ytdEisEmployer",
    required: false,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
  {
    csvColumn: "ytd_net_salary",
    targetField: "ytdNetSalary",
    required: true,
    validate: validators.positiveNumber,
    transform: transformers.toDecimalString,
  },
];

export interface CustomerRow {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  openingBalance: string;
}

export const customerMappings: ColumnMapping[] = [
  {
    csvColumn: "name",
    targetField: "name",
    required: true,
  },
  {
    csvColumn: "email",
    targetField: "email",
    required: false,
    validate: validators.email,
  },
  {
    csvColumn: "phone",
    targetField: "phone",
    required: false,
  },
  {
    csvColumn: "address",
    targetField: "address",
    required: false,
  },
  {
    csvColumn: "tax_id",
    targetField: "taxId",
    required: false,
  },
  {
    csvColumn: "opening_balance",
    targetField: "openingBalance",
    required: false,
    validate: validators.number,
    transform: transformers.toDecimalString,
  },
];

export interface VendorRow {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  openingBalance: string;
}

export const vendorMappings: ColumnMapping[] = [
  {
    csvColumn: "name",
    targetField: "name",
    required: true,
  },
  {
    csvColumn: "email",
    targetField: "email",
    required: false,
    validate: validators.email,
  },
  {
    csvColumn: "phone",
    targetField: "phone",
    required: false,
  },
  {
    csvColumn: "address",
    targetField: "address",
    required: false,
  },
  {
    csvColumn: "tax_id",
    targetField: "taxId",
    required: false,
  },
  {
    csvColumn: "opening_balance",
    targetField: "openingBalance",
    required: false,
    validate: validators.number,
    transform: transformers.toDecimalString,
  },
];

// ============================================================================
// CSV Template Generation
// ============================================================================

export function generateCSVTemplate(headers: string[]): string {
  return headers.join(",") + "\n";
}

export const templates = {
  openingBalances: generateCSVTemplate([
    "account_code",
    "account_name",
    "account_type",
    "debit",
    "credit",
  ]),

  payrollYtd: generateCSVTemplate([
    "employee_id",
    "employee_code",
    "employee_name",
    "as_of_date",
    "months_worked",
    "ytd_gross_salary",
    "ytd_base_salary",
    "ytd_allowances",
    "ytd_other_earnings",
    "ytd_total_deductions",
    "ytd_other_deductions",
    "ytd_epf_employee",
    "ytd_socso_employee",
    "ytd_eis_employee",
    "ytd_pcb",
    "ytd_epf_employer",
    "ytd_socso_employer",
    "ytd_eis_employer",
    "ytd_net_salary",
  ]),

  customers: generateCSVTemplate([
    "name",
    "email",
    "phone",
    "address",
    "tax_id",
    "opening_balance",
  ]),

  vendors: generateCSVTemplate([
    "name",
    "email",
    "phone",
    "address",
    "tax_id",
    "opening_balance",
  ]),
};

/**
 * Download a template CSV file
 */
export function downloadTemplate(templateName: keyof typeof templates, filename: string): void {
  const content = templates[templateName];
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
