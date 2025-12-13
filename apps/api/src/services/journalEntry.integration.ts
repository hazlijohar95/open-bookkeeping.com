/**
 * Journal Entry Integration Service
 * Creates automatic journal entries for invoices, bills, and payments
 *
 * All journal entries created here are auto-posted and ledger transactions updated.
 */

import { chartOfAccountsRepository, ledgerRepository, journalEntryRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import Decimal from "decimal.js";

const logger = createLogger("journal-entry-integration");

// System account codes from Malaysian SME Chart of Accounts
const SYSTEM_ACCOUNTS = {
  ACCOUNTS_RECEIVABLE: "1100",
  CASH_AT_BANK: "1020",
  SST_REFUNDABLE: "1400",
  ACCOUNTS_PAYABLE: "2100",
  SST_PAYABLE: "2310",
  SALES_REVENUE: "4100",
  SERVICE_REVENUE: "4200",
  PURCHASES: "5100",
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

interface InvoiceForJournalEntry {
  id: string;
  serialNumber: string;
  date: Date;
  currency: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  billingDetails?: Array<{
    label: string;
    type: "fixed" | "percentage";
    value: number;
    isSstTax?: boolean;
    sstTaxType?: "sales_tax" | "service_tax";
  }>;
  clientDetails: {
    name: string;
  };
}

interface BillForJournalEntry {
  id: string;
  billNumber: string;
  date: Date;
  currency: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  vendorName: string;
}

interface PaymentForJournalEntry {
  sourceType: "invoice" | "bill";
  sourceId: string;
  sourceNumber: string;
  amount: number;
  date: Date;
  paymentMethod?: string;
  partyName: string;
}

interface CreditNoteForJournalEntry {
  id: string;
  serialNumber: string;
  date: Date;
  reason: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  billingDetails?: Array<{
    label: string;
    type: "fixed" | "percentage";
    value: number;
    isSstTax?: boolean;
  }>;
  clientDetails: {
    name: string;
  };
  originalInvoiceNumber?: string;
}

interface DebitNoteForJournalEntry {
  id: string;
  serialNumber: string;
  date: Date;
  reason: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  billingDetails?: Array<{
    label: string;
    type: "fixed" | "percentage";
    value: number;
    isSstTax?: boolean;
  }>;
  clientDetails: {
    name: string;
  };
  originalInvoiceNumber?: string;
}

/**
 * Get account by code for a user
 */
async function getAccountByCode(
  userId: string,
  code: string
): Promise<AccountInfo | null> {
  const accounts = await chartOfAccountsRepository.findAllAccounts(userId, {
    isActive: true,
  });
  const account = accounts.find((a) => a.code === code);
  if (!account) return null;
  return { id: account.id, code: account.code, name: account.name };
}

/**
 * Validate that required system accounts exist and are active
 * Returns list of missing account codes or empty array if all exist
 */
async function validateSystemAccounts(
  userId: string,
  requiredCodes: string[]
): Promise<{ valid: boolean; missing: string[] }> {
  const accounts = await chartOfAccountsRepository.findAllAccounts(userId, {
    isActive: true,
  });
  const existingCodes = new Set(accounts.map((a) => a.code));
  const missing = requiredCodes.filter((code) => !existingCodes.has(code));
  return { valid: missing.length === 0, missing };
}

/**
 * Log warning if system accounts are missing
 */
function logMissingAccounts(userId: string, context: string, missing: string[]): void {
  if (missing.length > 0) {
    logger.warn(
      { userId, context, missingAccounts: missing },
      `System accounts not found: ${missing.join(", ")}. Journal entry may be incomplete.`
    );
  }
}

/**
 * Calculate invoice totals including tax
 */
function calculateInvoiceTotals(invoice: InvoiceForJournalEntry): {
  subtotal: Decimal;
  taxAmount: Decimal;
  total: Decimal;
} {
  // Calculate subtotal from items
  const subtotal = invoice.items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.quantity).times(item.unitPrice));
  }, new Decimal(0));

  // Calculate tax amount from billing details
  let taxAmount = new Decimal(0);
  if (invoice.billingDetails) {
    for (const billing of invoice.billingDetails) {
      if (billing.isSstTax) {
        if (billing.type === "percentage") {
          taxAmount = taxAmount.plus(subtotal.times(billing.value).dividedBy(100));
        } else {
          taxAmount = taxAmount.plus(billing.value);
        }
      }
    }
  }

  const total = subtotal.plus(taxAmount);

  return { subtotal, taxAmount, total };
}

/**
 * Create journal entry for a sent/created invoice
 * Debit: Accounts Receivable (total)
 * Credit: Sales Revenue (subtotal)
 * Credit: SST Payable (tax amount if any)
 */
export async function createInvoiceJournalEntry(
  userId: string,
  invoice: InvoiceForJournalEntry
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    // Get required accounts
    const arAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE);
    const revenueAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SALES_REVENUE);
    const sstPayableAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SST_PAYABLE);

    if (!arAccount) {
      return { success: false, error: "Accounts Receivable account (1100) not found. Please initialize chart of accounts." };
    }
    if (!revenueAccount) {
      return { success: false, error: "Sales Revenue account (4100) not found. Please initialize chart of accounts." };
    }

    const { subtotal, taxAmount, total } = calculateInvoiceTotals(invoice);

    // Build journal entry lines
    const lines: JournalEntryLine[] = [
      {
        accountId: arAccount.id,
        debitAmount: total.toFixed(2),
        description: `Invoice ${invoice.serialNumber} - ${invoice.clientDetails.name}`,
      },
      {
        accountId: revenueAccount.id,
        creditAmount: subtotal.toFixed(2),
        description: `Sales - Invoice ${invoice.serialNumber}`,
      },
    ];

    // Add SST payable line if there's tax
    if (taxAmount.greaterThan(0) && sstPayableAccount) {
      lines.push({
        accountId: sstPayableAccount.id,
        creditAmount: taxAmount.toFixed(2),
        description: `SST - Invoice ${invoice.serialNumber}`,
      });
    }

    // Create the journal entry
    const entry = await chartOfAccountsRepository.createJournalEntry({
      userId,
      entryDate: invoice.date.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "",
      description: `Invoice ${invoice.serialNumber} to ${invoice.clientDetails.name}`,
      reference: invoice.serialNumber,
      sourceType: "invoice",
      sourceId: invoice.id,
      lines,
    });

    if (!entry) {
      return { success: false, error: "Failed to create journal entry" };
    }

    // Auto-post the journal entry
    await journalEntryRepository.post(entry.id, userId);

    // Update ledger transactions
    await ledgerRepository.updateLedgerTransactions(entry.id, userId);

    logger.info(
      { userId, invoiceId: invoice.id, entryId: entry.id },
      `Created and posted journal entry ${entry.entryNumber} for invoice ${invoice.serialNumber}`
    );

    return { success: true, entryId: entry.id };
  } catch (error) {
    logger.error({ error, userId, invoiceId: invoice.id }, "Failed to create invoice journal entry");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create journal entry for an invoice payment
 * Debit: Cash at Bank
 * Credit: Accounts Receivable
 */
export async function createPaymentJournalEntry(
  userId: string,
  payment: PaymentForJournalEntry
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    const cashAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.CASH_AT_BANK);
    const arAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE);
    const apAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE);

    if (!cashAccount) {
      return { success: false, error: "Cash at Bank account (1020) not found. Please initialize chart of accounts." };
    }

    const amount = new Decimal(payment.amount).toFixed(2);
    const lines: JournalEntryLine[] = [];

    if (payment.sourceType === "invoice") {
      // Invoice payment: Debit Cash, Credit AR
      if (!arAccount) {
        return { success: false, error: "Accounts Receivable account (1100) not found." };
      }
      lines.push(
        {
          accountId: cashAccount.id,
          debitAmount: amount,
          description: `Payment received - ${payment.sourceNumber}`,
        },
        {
          accountId: arAccount.id,
          creditAmount: amount,
          description: `Invoice payment - ${payment.sourceNumber}`,
        }
      );
    } else {
      // Bill payment: Debit AP, Credit Cash
      if (!apAccount) {
        return { success: false, error: "Accounts Payable account (2100) not found." };
      }
      lines.push(
        {
          accountId: apAccount.id,
          debitAmount: amount,
          description: `Bill payment - ${payment.sourceNumber}`,
        },
        {
          accountId: cashAccount.id,
          creditAmount: amount,
          description: `Payment made - ${payment.sourceNumber}`,
        }
      );
    }

    const dateStr = payment.date.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "";
    const entry = await chartOfAccountsRepository.createJournalEntry({
      userId,
      entryDate: dateStr,
      description:
        payment.sourceType === "invoice"
          ? `Payment received from ${payment.partyName} - ${payment.sourceNumber}`
          : `Payment to ${payment.partyName} - ${payment.sourceNumber}`,
      reference: payment.sourceNumber,
      sourceType: payment.sourceType === "invoice" ? "invoice" : "bill",
      sourceId: payment.sourceId,
      lines,
    });

    if (!entry) {
      return { success: false, error: "Failed to create payment journal entry" };
    }

    logger.info(
      { userId, sourceType: payment.sourceType, sourceId: payment.sourceId, entryId: entry.id },
      `Created payment journal entry ${entry.entryNumber}`
    );

    return { success: true, entryId: entry.id };
  } catch (error) {
    logger.error({ error, userId }, "Failed to create payment journal entry");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create journal entry for a bill
 * Debit: Purchases / Expense
 * Debit: SST Refundable (if tax)
 * Credit: Accounts Payable
 */
export async function createBillJournalEntry(
  userId: string,
  bill: BillForJournalEntry
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    const apAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE);
    const purchasesAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.PURCHASES);
    const sstRefundableAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SST_REFUNDABLE);

    if (!apAccount) {
      return { success: false, error: "Accounts Payable account (2100) not found. Please initialize chart of accounts." };
    }
    if (!purchasesAccount) {
      return { success: false, error: "Purchases account (5100) not found. Please initialize chart of accounts." };
    }

    const subtotal = new Decimal(bill.subtotal);
    const taxAmount = new Decimal(bill.taxAmount);
    const total = new Decimal(bill.total);

    const lines: JournalEntryLine[] = [
      {
        accountId: purchasesAccount.id,
        debitAmount: subtotal.toFixed(2),
        description: `Purchases - Bill ${bill.billNumber}`,
      },
    ];

    // Add SST refundable if there's input tax
    if (taxAmount.greaterThan(0) && sstRefundableAccount) {
      lines.push({
        accountId: sstRefundableAccount.id,
        debitAmount: taxAmount.toFixed(2),
        description: `SST Input - Bill ${bill.billNumber}`,
      });
    }

    // Credit Accounts Payable
    lines.push({
      accountId: apAccount.id,
      creditAmount: total.toFixed(2),
      description: `Bill ${bill.billNumber} - ${bill.vendorName}`,
    });

    const dateStr = bill.date.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "";
    const entry = await chartOfAccountsRepository.createJournalEntry({
      userId,
      entryDate: dateStr,
      description: `Bill ${bill.billNumber} from ${bill.vendorName}`,
      reference: bill.billNumber,
      sourceType: "bill",
      sourceId: bill.id,
      lines,
    });

    if (!entry) {
      return { success: false, error: "Failed to create bill journal entry" };
    }

    // Auto-post the journal entry
    await journalEntryRepository.post(entry.id, userId);

    // Update ledger transactions
    await ledgerRepository.updateLedgerTransactions(entry.id, userId);

    logger.info(
      { userId, billId: bill.id, entryId: entry.id },
      `Created and posted journal entry ${entry.entryNumber} for bill ${bill.billNumber}`
    );

    return { success: true, entryId: entry.id };
  } catch (error) {
    logger.error({ error, userId, billId: bill.id }, "Failed to create bill journal entry");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a user has chart of accounts initialized
 * Also validates that core system accounts exist
 */
export async function hasChartOfAccounts(userId: string): Promise<boolean> {
  const accounts = await chartOfAccountsRepository.findAllAccounts(userId, {
    isActive: true,
  });

  if (accounts.length === 0) {
    return false;
  }

  // Validate core system accounts exist
  const coreAccounts = [
    SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE, // 1100
    SYSTEM_ACCOUNTS.ACCOUNTS_PAYABLE,    // 2100
    SYSTEM_ACCOUNTS.SALES_REVENUE,       // 4100
  ];

  const validation = await validateSystemAccounts(userId, coreAccounts);
  if (!validation.valid) {
    logMissingAccounts(userId, "hasChartOfAccounts", validation.missing);
  }

  return true;
}

/**
 * Calculate note totals (for credit/debit notes)
 */
function calculateNoteTotals(note: CreditNoteForJournalEntry | DebitNoteForJournalEntry): {
  subtotal: Decimal;
  taxAmount: Decimal;
  total: Decimal;
} {
  // Calculate subtotal from items
  const subtotal = note.items.reduce((sum, item) => {
    return sum.plus(new Decimal(item.quantity).times(item.unitPrice));
  }, new Decimal(0));

  // Calculate tax amount from billing details
  let taxAmount = new Decimal(0);
  if (note.billingDetails) {
    for (const billing of note.billingDetails) {
      if (billing.isSstTax) {
        if (billing.type === "percentage") {
          taxAmount = taxAmount.plus(subtotal.times(billing.value).dividedBy(100));
        } else {
          taxAmount = taxAmount.plus(billing.value);
        }
      }
    }
  }

  const total = subtotal.plus(taxAmount);

  return { subtotal, taxAmount, total };
}

/**
 * Create journal entry for a credit note (REVERSES revenue)
 * Credit Note reduces Accounts Receivable and Revenue
 *
 * Debit: Sales Revenue (subtotal) - reduces revenue
 * Debit: SST Payable (tax amount if any) - reduces tax liability
 * Credit: Accounts Receivable (total) - reduces receivable
 */
export async function createCreditNoteJournalEntry(
  userId: string,
  creditNote: CreditNoteForJournalEntry
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    // Get required accounts
    const arAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE);
    const revenueAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SALES_REVENUE);
    const sstPayableAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SST_PAYABLE);

    if (!arAccount) {
      return { success: false, error: "Accounts Receivable account (1100) not found. Please initialize chart of accounts." };
    }
    if (!revenueAccount) {
      return { success: false, error: "Sales Revenue account (4100) not found. Please initialize chart of accounts." };
    }

    const { subtotal, taxAmount, total } = calculateNoteTotals(creditNote);

    // Build journal entry lines (REVERSE of invoice entry)
    const lines: JournalEntryLine[] = [
      {
        accountId: revenueAccount.id,
        debitAmount: subtotal.toFixed(2),
        description: `Credit Note ${creditNote.serialNumber} - Revenue adjustment`,
      },
    ];

    // Add SST payable reversal if there's tax
    if (taxAmount.greaterThan(0) && sstPayableAccount) {
      lines.push({
        accountId: sstPayableAccount.id,
        debitAmount: taxAmount.toFixed(2),
        description: `Credit Note ${creditNote.serialNumber} - SST adjustment`,
      });
    }

    // Credit Accounts Receivable (reduces what customer owes)
    lines.push({
      accountId: arAccount.id,
      creditAmount: total.toFixed(2),
      description: `Credit Note ${creditNote.serialNumber} - ${creditNote.clientDetails.name}`,
    });

    // Create the journal entry
    const dateStr = creditNote.date.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "";
    const description = creditNote.originalInvoiceNumber
      ? `Credit Note ${creditNote.serialNumber} for ${creditNote.originalInvoiceNumber} - ${creditNote.reason}`
      : `Credit Note ${creditNote.serialNumber} to ${creditNote.clientDetails.name} - ${creditNote.reason}`;

    const entry = await chartOfAccountsRepository.createJournalEntry({
      userId,
      entryDate: dateStr,
      description,
      reference: creditNote.serialNumber,
      sourceType: "credit_note",
      sourceId: creditNote.id,
      lines,
    });

    if (!entry) {
      return { success: false, error: "Failed to create credit note journal entry" };
    }

    // Auto-post the journal entry
    await journalEntryRepository.post(entry.id, userId);

    // Update ledger transactions
    await ledgerRepository.updateLedgerTransactions(entry.id, userId);

    logger.info(
      { userId, creditNoteId: creditNote.id, entryId: entry.id },
      `Created and posted journal entry ${entry.entryNumber} for credit note ${creditNote.serialNumber}`
    );

    return { success: true, entryId: entry.id };
  } catch (error) {
    logger.error({ error, userId, creditNoteId: creditNote.id }, "Failed to create credit note journal entry");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create journal entry for a debit note (ADDS to revenue)
 * Debit Note increases Accounts Receivable and Revenue
 *
 * Debit: Accounts Receivable (total) - increases receivable
 * Credit: Sales Revenue (subtotal) - increases revenue
 * Credit: SST Payable (tax amount if any) - increases tax liability
 */
export async function createDebitNoteJournalEntry(
  userId: string,
  debitNote: DebitNoteForJournalEntry
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    // Get required accounts
    const arAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.ACCOUNTS_RECEIVABLE);
    const revenueAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SALES_REVENUE);
    const sstPayableAccount = await getAccountByCode(userId, SYSTEM_ACCOUNTS.SST_PAYABLE);

    if (!arAccount) {
      return { success: false, error: "Accounts Receivable account (1100) not found. Please initialize chart of accounts." };
    }
    if (!revenueAccount) {
      return { success: false, error: "Sales Revenue account (4100) not found. Please initialize chart of accounts." };
    }

    const { subtotal, taxAmount, total } = calculateNoteTotals(debitNote);

    // Build journal entry lines (SAME as invoice entry - adds to AR and Revenue)
    const lines: JournalEntryLine[] = [
      {
        accountId: arAccount.id,
        debitAmount: total.toFixed(2),
        description: `Debit Note ${debitNote.serialNumber} - ${debitNote.clientDetails.name}`,
      },
      {
        accountId: revenueAccount.id,
        creditAmount: subtotal.toFixed(2),
        description: `Debit Note ${debitNote.serialNumber} - Additional charges`,
      },
    ];

    // Add SST payable if there's tax
    if (taxAmount.greaterThan(0) && sstPayableAccount) {
      lines.push({
        accountId: sstPayableAccount.id,
        creditAmount: taxAmount.toFixed(2),
        description: `Debit Note ${debitNote.serialNumber} - SST`,
      });
    }

    // Create the journal entry
    const dateStr = debitNote.date.toISOString().split("T")[0] ?? new Date().toISOString().split("T")[0] ?? "";
    const description = debitNote.originalInvoiceNumber
      ? `Debit Note ${debitNote.serialNumber} for ${debitNote.originalInvoiceNumber} - ${debitNote.reason}`
      : `Debit Note ${debitNote.serialNumber} to ${debitNote.clientDetails.name} - ${debitNote.reason}`;

    const entry = await chartOfAccountsRepository.createJournalEntry({
      userId,
      entryDate: dateStr,
      description,
      reference: debitNote.serialNumber,
      sourceType: "debit_note",
      sourceId: debitNote.id,
      lines,
    });

    if (!entry) {
      return { success: false, error: "Failed to create debit note journal entry" };
    }

    // Auto-post the journal entry
    await journalEntryRepository.post(entry.id, userId);

    // Update ledger transactions
    await ledgerRepository.updateLedgerTransactions(entry.id, userId);

    logger.info(
      { userId, debitNoteId: debitNote.id, entryId: entry.id },
      `Created and posted journal entry ${entry.entryNumber} for debit note ${debitNote.serialNumber}`
    );

    return { success: true, entryId: entry.id };
  } catch (error) {
    logger.error({ error, userId, debitNoteId: debitNote.id }, "Failed to create debit note journal entry");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const journalEntryIntegration = {
  createInvoiceJournalEntry,
  createPaymentJournalEntry,
  createBillJournalEntry,
  createCreditNoteJournalEntry,
  createDebitNoteJournalEntry,
  hasChartOfAccounts,
};
