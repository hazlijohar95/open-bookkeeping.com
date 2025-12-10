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
  "fixed_asset_depreciation",
  "fixed_asset_disposal",
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

// Fixed Assets enums
export const depreciationMethodEnum = pgEnum("depreciation_method", [
  "straight_line", // (Cost - Salvage) / Life
  "declining_balance", // NBV × Rate
  "double_declining", // NBV × (2/Life)
]);

export const acquisitionMethodEnum = pgEnum("acquisition_method", [
  "purchase", // Bought from vendor
  "donation", // Received as gift
  "transfer", // Transferred from another entity
  "lease_to_own", // Finance lease converted to ownership
]);

export const fixedAssetStatusEnum = pgEnum("fixed_asset_status", [
  "draft", // Not yet active
  "active", // Depreciating
  "fully_depreciated", // NBV = Salvage value
  "disposed", // Sold, scrapped, or donated
]);

export const disposalMethodEnum = pgEnum("disposal_method", [
  "sale", // Sold to buyer
  "scrapped", // Written off/destroyed
  "donation", // Given away
  "trade_in", // Exchanged for new asset
]);

export const depreciationScheduleStatusEnum = pgEnum("depreciation_schedule_status", [
  "scheduled", // Planned but not posted
  "posted", // Journal entry created
  "skipped", // Manually skipped
]);

// AI Agent enums
export const agentSessionStatusEnum = pgEnum("agent_session_status", [
  "active", // Currently in use
  "completed", // User ended session
  "archived", // Stored for reference
]);

export const agentApprovalStatusEnum = pgEnum("agent_approval_status", [
  "pending", // Awaiting human review
  "approved", // Human approved the action
  "rejected", // Human rejected the action
  "expired", // Approval window closed
  "auto_approved", // System auto-approved based on rules
]);

export const agentWorkflowStatusEnum = pgEnum("agent_workflow_status", [
  "pending", // Not yet started
  "running", // Currently executing
  "paused", // Manually paused
  "awaiting_approval", // Waiting for human approval
  "completed", // All steps finished successfully
  "failed", // Encountered unrecoverable error
  "cancelled", // User cancelled
]);

export const agentWorkflowStepStatusEnum = pgEnum("agent_workflow_step_status", [
  "pending", // Not yet executed
  "running", // Currently executing
  "completed", // Finished successfully
  "failed", // Encountered error
  "skipped", // Skipped due to conditions
]);

export const agentActionTypeEnum = pgEnum("agent_action_type", [
  // Invoice actions
  "create_invoice",
  "update_invoice",
  "send_invoice",
  "mark_invoice_paid",
  "void_invoice",
  // Bill actions
  "create_bill",
  "update_bill",
  "mark_bill_paid",
  "schedule_bill_payment",
  // Journal entry actions
  "create_journal_entry",
  "reverse_journal_entry",
  // Quotation actions
  "create_quotation",
  "update_quotation",
  "send_quotation",
  "convert_quotation",
  // Customer/Vendor actions
  "create_customer",
  "update_customer",
  "create_vendor",
  "update_vendor",
  // Bank reconciliation
  "match_transaction",
  "create_matching_entry",
  // Other
  "read_data",
  "analyze_data",
]);

export const agentApprovalTypeEnum = pgEnum("agent_approval_type", [
  "auto", // Auto-approved by system rules
  "manual", // Explicitly approved by user
  "threshold", // Approved because below threshold
]);
