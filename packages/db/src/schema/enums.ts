import { pgEnum } from "drizzle-orm/pg-core";

// Shared enums used across multiple tables

// Invoice enums
export const invoiceTypeEnum = pgEnum("invoice_type", ["local", "server"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "success",
  "error",
  "expired",
  "refunded",
]);
export const billingDetailTypeEnum = pgEnum("billing_detail_type", [
  "fixed",
  "percentage",
]);

// Quotation enums
export const quotationTypeEnum = pgEnum("quotation_type", ["local", "server"]);
export const quotationStatusEnum = pgEnum("quotation_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted",
]);

// Credit Note enums
export const creditNoteTypeEnum = pgEnum("credit_note_type", ["local", "server"]);
export const creditNoteStatusEnum = pgEnum("credit_note_status", [
  "draft",
  "issued",
  "applied",
  "cancelled",
]);
export const noteReasonEnum = pgEnum("note_reason", [
  "return",
  "discount",
  "pricing_error",
  "damaged_goods",
  "other",
]);

// Debit Note enums
export const debitNoteTypeEnum = pgEnum("debit_note_type", ["local", "server"]);
export const debitNoteStatusEnum = pgEnum("debit_note_status", [
  "draft",
  "issued",
  "applied",
  "cancelled",
]);

// Bill enums (Accounts Payable - what we owe vendors)
export const billStatusEnum = pgEnum("bill_status", [
  "draft",
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);

// Bank Feed enums
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",
  "withdrawal",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "unmatched",
  "suggested",
  "matched",
  "excluded",
]);
export const transactionCategoryTypeEnum = pgEnum("transaction_category_type", [
  "income",
  "expense",
]);

// Chart of Accounts enums
export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const normalBalanceEnum = pgEnum("normal_balance", ["debit", "credit"]);

export const journalEntryStatusEnum = pgEnum("journal_entry_status", [
  "draft",
  "posted",
  "reversed",
]);

export const sourceDocumentTypeEnum = pgEnum("source_document_type", [
  "invoice",
  "bill",
  "bank_transaction",
  "manual",
  "credit_note",
  "debit_note",
]);

export const sstTaxCodeEnum = pgEnum("sst_tax_code", [
  "sr", // Standard Rate (6%)
  "zrl", // Zero-Rated Local
  "es", // Exempt Supply
  "os", // Out of Scope
  "rs", // Relief Supply
  "gs", // Goods Suspended
  "none", // No tax applicable
]);

// SST (Sales and Service Tax) for Malaysia
export const sstTaxTypeEnum = pgEnum("sst_tax_type", [
  "sales_tax", // Sales Tax on goods (0%, 5%, 10%)
  "service_tax", // Service Tax on services (6%, 8%)
]);

// Accounting Period enums (for period closing)
export const accountingPeriodStatusEnum = pgEnum("accounting_period_status", [
  "open", // Transactions can be posted
  "closed", // No new transactions allowed
  "locked", // Permanently locked (year-end)
]);
