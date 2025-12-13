/**
 * Payroll Journal Integration Service
 *
 * Creates journal entries for payroll runs:
 *
 * When payroll is FINALIZED:
 * DR 6110 Salaries & Wages              [Gross Salary]
 * DR 6120 EPF Contribution (Employer)   [Employer EPF]
 * DR 6130 SOCSO Contribution (Employer) [Employer SOCSO]
 * DR 6140 EIS Contribution (Employer)   [Employer EIS]
 * CR 2210 Accrued Salaries              [Net Salary Payable]
 * CR 2410 EPF Payable                   [Total EPF]
 * CR 2420 SOCSO Payable                 [Total SOCSO]
 * CR 2430 EIS Payable                   [Total EIS]
 * CR 2440 PCB Payable                   [PCB Amount]
 *
 * When salaries are PAID:
 * DR 2210 Accrued Salaries              [Net Salary]
 * CR 1020 Cash at Bank                  [Net Salary]
 */

import Decimal from "decimal.js";
import { createLogger } from "@open-bookkeeping/shared";
import {
  chartOfAccountsRepository,
  journalEntryRepository,
  payrollRunRepository,
  type PayrollRun,
} from "@open-bookkeeping/db";

const logger = createLogger("payroll-journal");

// Account codes from Malaysian SME Chart of Accounts
const PAYROLL_ACCOUNTS = {
  // Expenses
  SALARIES_WAGES: "6110",
  EPF_EMPLOYER: "6120",
  SOCSO_EMPLOYER: "6130",
  EIS_EMPLOYER: "6140",
  // Liabilities
  ACCRUED_SALARIES: "2210",
  EPF_PAYABLE: "2410",
  SOCSO_PAYABLE: "2420",
  EIS_PAYABLE: "2430",
  PCB_PAYABLE: "2440",
  // Assets
  CASH_AT_BANK: "1020",
};

interface AccountInfo {
  id: string;
  code: string;
  name: string;
}

interface JournalEntryLine {
  accountId: string;
  debitAmount?: string;
  creditAmount?: string;
  description?: string;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Create journal entry when payroll is finalized
 */
export async function createPayrollAccrualEntry(
  userId: string,
  payrollRun: PayrollRun
): Promise<string | null> {
  logger.info({
    payrollRunId: payrollRun.id,
    period: `${payrollRun.periodYear}-${payrollRun.periodMonth}`,
  }, "Creating payroll accrual journal entry");

  try {
    // Get required accounts
    const accounts = await getPayrollAccounts(userId);
    if (!accounts) {
      logger.error({}, "Failed to get payroll accounts");
      return null;
    }

    // Prepare journal entry lines
    const lines: JournalEntryLine[] = [];
    const grossSalary = new Decimal(payrollRun.totalGrossSalary || "0");
    const epfEmployer = new Decimal(payrollRun.totalEpfEmployer || "0");
    const socsoEmployer = new Decimal(payrollRun.totalSocsoEmployer || "0");
    const eisEmployer = new Decimal(payrollRun.totalEisEmployer || "0");
    const epfEmployee = new Decimal(payrollRun.totalEpfEmployee || "0");
    const socsoEmployee = new Decimal(payrollRun.totalSocsoEmployee || "0");
    const eisEmployee = new Decimal(payrollRun.totalEisEmployee || "0");
    const pcb = new Decimal(payrollRun.totalPcb || "0");
    const netSalary = new Decimal(payrollRun.totalNetSalary || "0");

    // Total EPF = employer + employee
    const totalEpf = epfEmployer.add(epfEmployee);
    const totalSocso = socsoEmployer.add(socsoEmployee);
    const totalEis = eisEmployer.add(eisEmployee);

    // DEBIT entries (expenses)
    if (grossSalary.gt(0)) {
      lines.push({
        accountId: accounts.salariesWages.id,
        debitAmount: grossSalary.toFixed(2),
        description: `Salaries & Wages - ${payrollRun.name || getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (epfEmployer.gt(0)) {
      lines.push({
        accountId: accounts.epfEmployer.id,
        debitAmount: epfEmployer.toFixed(2),
        description: `EPF Employer Contribution - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (socsoEmployer.gt(0)) {
      lines.push({
        accountId: accounts.socsoEmployer.id,
        debitAmount: socsoEmployer.toFixed(2),
        description: `SOCSO Employer Contribution - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (eisEmployer.gt(0)) {
      lines.push({
        accountId: accounts.eisEmployer.id,
        debitAmount: eisEmployer.toFixed(2),
        description: `EIS Employer Contribution - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    // CREDIT entries (liabilities)
    if (netSalary.gt(0)) {
      lines.push({
        accountId: accounts.accruedSalaries.id,
        creditAmount: netSalary.toFixed(2),
        description: `Net Salaries Payable - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (totalEpf.gt(0)) {
      lines.push({
        accountId: accounts.epfPayable.id,
        creditAmount: totalEpf.toFixed(2),
        description: `EPF Payable (ER + EE) - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (totalSocso.gt(0)) {
      lines.push({
        accountId: accounts.socsoPayable.id,
        creditAmount: totalSocso.toFixed(2),
        description: `SOCSO Payable (ER + EE) - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (totalEis.gt(0)) {
      lines.push({
        accountId: accounts.eisPayable.id,
        creditAmount: totalEis.toFixed(2),
        description: `EIS Payable (ER + EE) - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    if (pcb.gt(0)) {
      lines.push({
        accountId: accounts.pcbPayable.id,
        creditAmount: pcb.toFixed(2),
        description: `PCB Payable - ${getMonthName(payrollRun.periodMonth)}`,
      });
    }

    // Validate debits = credits
    const totalDebits = lines.reduce(
      (sum, line) => sum.add(line.debitAmount || "0"),
      new Decimal(0)
    );
    const totalCredits = lines.reduce(
      (sum, line) => sum.add(line.creditAmount || "0"),
      new Decimal(0)
    );

    if (!totalDebits.eq(totalCredits)) {
      logger.error({
        totalDebits: totalDebits.toFixed(2),
        totalCredits: totalCredits.toFixed(2),
      }, "Journal entry does not balance");
      return null;
    }

    // Create journal entry
    const entryDate: string = payrollRun.payDate ?? new Date().toISOString().split("T")[0];
    const description = `Payroll Accrual - ${payrollRun.name || `${getMonthName(payrollRun.periodMonth)} ${payrollRun.periodYear}`}`;

    const journalEntry = await journalEntryRepository.create({
      userId,
      entryDate,
      description,
      reference: payrollRun.runNumber,
      sourceType: "payroll",
      sourceId: payrollRun.id,
      lines: lines.map((line, index) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount || "0",
        creditAmount: line.creditAmount || "0",
        description: line.description,
        lineNumber: index + 1,
      })),
    });

    if (journalEntry) {
      // Link journal entry to payroll run
      await payrollRunRepository.linkJournalEntry(payrollRun.id, userId, journalEntry.id);

      // Auto-post the journal entry
      await journalEntryRepository.post(journalEntry.id, userId);

      logger.info({
        journalEntryId: journalEntry.id,
        payrollRunId: payrollRun.id,
      }, "Payroll accrual journal entry created and posted");

      return journalEntry.id;
    }

    return null;
  } catch (error) {
    logger.error({ error }, "Failed to create payroll accrual journal entry");
    throw error;
  }
}

/**
 * Create journal entry when salaries are paid
 */
export async function createPayrollPaymentEntry(
  userId: string,
  payrollRun: PayrollRun,
  paymentDate: string,
  bankAccountId?: string
): Promise<string | null> {
  logger.info({
    payrollRunId: payrollRun.id,
    paymentDate,
  }, "Creating payroll payment journal entry");

  try {
    // Get required accounts
    const accounts = await getPayrollAccounts(userId);
    if (!accounts) {
      logger.error({}, "Failed to get payroll accounts");
      return null;
    }

    const netSalary = new Decimal(payrollRun.totalNetSalary || "0");

    if (netSalary.lte(0)) {
      logger.warn({ payrollRunId: payrollRun.id }, "No net salary to pay");
      return null;
    }

    // Use provided bank account or default
    const bankAccountIdToUse = bankAccountId || accounts.cashAtBank.id;

    const lines: JournalEntryLine[] = [
      // Debit: Clear accrued salaries liability
      {
        accountId: accounts.accruedSalaries.id,
        debitAmount: netSalary.toFixed(2),
        description: `Salary Payment - ${getMonthName(payrollRun.periodMonth)}`,
      },
      // Credit: Cash paid out
      {
        accountId: bankAccountIdToUse,
        creditAmount: netSalary.toFixed(2),
        description: `Salary Payment - ${getMonthName(payrollRun.periodMonth)}`,
      },
    ];

    const description = `Salary Payment - ${payrollRun.name || `${getMonthName(payrollRun.periodMonth)} ${payrollRun.periodYear}`}`;

    const journalEntry = await journalEntryRepository.create({
      userId,
      entryDate: paymentDate,
      description,
      reference: `${payrollRun.runNumber}-PAY`,
      sourceType: "payroll",
      sourceId: payrollRun.id,
      lines: lines.map((line, index) => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount || "0",
        creditAmount: line.creditAmount || "0",
        description: line.description,
        lineNumber: index + 1,
      })),
    });

    if (journalEntry) {
      // Auto-post the journal entry
      await journalEntryRepository.post(journalEntry.id, userId);

      logger.info({
        journalEntryId: journalEntry.id,
        payrollRunId: payrollRun.id,
      }, "Payroll payment journal entry created and posted");

      return journalEntry.id;
    }

    return null;
  } catch (error) {
    logger.error({ error }, "Failed to create payroll payment journal entry");
    throw error;
  }
}

/**
 * Reverse payroll journal entry (for cancelled payroll)
 */
export async function reversePayrollEntry(
  userId: string,
  journalEntryId: string,
  reversalDate?: string
): Promise<string | null> {
  try {
    const date: string = reversalDate ?? new Date().toISOString().split("T")[0] ?? "";
    const reversalEntry = await journalEntryRepository.reverse(journalEntryId, userId, date);
    if (reversalEntry) {
      logger.info({
        originalId: journalEntryId,
        reversalId: reversalEntry.id,
      }, "Payroll journal entry reversed");
    }
    return reversalEntry?.id || null;
  } catch (error) {
    logger.error({ error }, "Failed to reverse payroll journal entry");
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface PayrollAccounts {
  salariesWages: AccountInfo;
  epfEmployer: AccountInfo;
  socsoEmployer: AccountInfo;
  eisEmployer: AccountInfo;
  accruedSalaries: AccountInfo;
  epfPayable: AccountInfo;
  socsoPayable: AccountInfo;
  eisPayable: AccountInfo;
  pcbPayable: AccountInfo;
  cashAtBank: AccountInfo;
}

async function getPayrollAccounts(userId: string): Promise<PayrollAccounts | null> {
  const requiredCodes = [
    PAYROLL_ACCOUNTS.SALARIES_WAGES,
    PAYROLL_ACCOUNTS.EPF_EMPLOYER,
    PAYROLL_ACCOUNTS.SOCSO_EMPLOYER,
    PAYROLL_ACCOUNTS.EIS_EMPLOYER,
    PAYROLL_ACCOUNTS.ACCRUED_SALARIES,
    PAYROLL_ACCOUNTS.EPF_PAYABLE,
    PAYROLL_ACCOUNTS.SOCSO_PAYABLE,
    PAYROLL_ACCOUNTS.EIS_PAYABLE,
    PAYROLL_ACCOUNTS.PCB_PAYABLE,
    PAYROLL_ACCOUNTS.CASH_AT_BANK,
  ];

  const accounts: Record<string, AccountInfo> = {};

  for (const code of requiredCodes) {
    // Note: findAccountByCode expects (code, userId) not (userId, code)
    const account = await chartOfAccountsRepository.findAccountByCode(code, userId);
    if (!account) {
      logger.error({ code }, "Required account not found");
      return null;
    }
    accounts[code] = {
      id: account.id,
      code: account.code,
      name: account.name,
    };
  }

  const salariesWages = accounts[PAYROLL_ACCOUNTS.SALARIES_WAGES];
  const epfEmployer = accounts[PAYROLL_ACCOUNTS.EPF_EMPLOYER];
  const socsoEmployer = accounts[PAYROLL_ACCOUNTS.SOCSO_EMPLOYER];
  const eisEmployer = accounts[PAYROLL_ACCOUNTS.EIS_EMPLOYER];
  const accruedSalaries = accounts[PAYROLL_ACCOUNTS.ACCRUED_SALARIES];
  const epfPayable = accounts[PAYROLL_ACCOUNTS.EPF_PAYABLE];
  const socsoPayable = accounts[PAYROLL_ACCOUNTS.SOCSO_PAYABLE];
  const eisPayable = accounts[PAYROLL_ACCOUNTS.EIS_PAYABLE];
  const pcbPayable = accounts[PAYROLL_ACCOUNTS.PCB_PAYABLE];
  const cashAtBank = accounts[PAYROLL_ACCOUNTS.CASH_AT_BANK];

  // Check all required accounts exist
  if (!salariesWages || !epfEmployer || !socsoEmployer || !eisEmployer ||
      !accruedSalaries || !epfPayable || !socsoPayable || !eisPayable ||
      !pcbPayable || !cashAtBank) {
    return null;
  }

  return {
    salariesWages,
    epfEmployer,
    socsoEmployer,
    eisEmployer,
    accruedSalaries,
    epfPayable,
    socsoPayable,
    eisPayable,
    pcbPayable,
    cashAtBank,
  };
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1] || "";
}

/**
 * Get statutory payment amounts for remittance
 */
export async function getStatutoryPaymentSummary(
  _userId: string,
  payrollRun: PayrollRun
) {
  const epfEmployer = new Decimal(payrollRun.totalEpfEmployer || "0");
  const epfEmployee = new Decimal(payrollRun.totalEpfEmployee || "0");
  const socsoEmployer = new Decimal(payrollRun.totalSocsoEmployer || "0");
  const socsoEmployee = new Decimal(payrollRun.totalSocsoEmployee || "0");
  const eisEmployer = new Decimal(payrollRun.totalEisEmployer || "0");
  const eisEmployee = new Decimal(payrollRun.totalEisEmployee || "0");
  const pcb = new Decimal(payrollRun.totalPcb || "0");

  return {
    epf: {
      employer: epfEmployer.toFixed(2),
      employee: epfEmployee.toFixed(2),
      total: epfEmployer.add(epfEmployee).toFixed(2),
      dueDate: getStatutoryDueDate(payrollRun.periodYear, payrollRun.periodMonth, "epf"),
    },
    socso: {
      employer: socsoEmployer.toFixed(2),
      employee: socsoEmployee.toFixed(2),
      total: socsoEmployer.add(socsoEmployee).toFixed(2),
      dueDate: getStatutoryDueDate(payrollRun.periodYear, payrollRun.periodMonth, "socso"),
    },
    eis: {
      employer: eisEmployer.toFixed(2),
      employee: eisEmployee.toFixed(2),
      total: eisEmployer.add(eisEmployee).toFixed(2),
      dueDate: getStatutoryDueDate(payrollRun.periodYear, payrollRun.periodMonth, "eis"),
    },
    pcb: {
      total: pcb.toFixed(2),
      dueDate: getStatutoryDueDate(payrollRun.periodYear, payrollRun.periodMonth, "pcb"),
    },
  };
}

/**
 * Get statutory due date (15th of following month)
 */
function getStatutoryDueDate(year: number, month: number, _type: string): string {
  // All statutory contributions due on 15th of following month
  let dueYear = year;
  let dueMonth = month + 1;

  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear++;
  }

  return `${dueYear}-${dueMonth.toString().padStart(2, "0")}-15`;
}
