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

// Account sub-types for flexible categorization
// This replaces hard-coded account code ranges in P&L and Balance Sheet
export const accountSubTypeEnum = pgEnum("account_sub_type", [
  // Asset sub-types
  "current_asset", // Cash, AR, inventory (1000-1499)
  "fixed_asset", // PPE, intangibles (1500+)
  // Liability sub-types
  "current_liability", // AP, accruals, short-term debt (2000-2599)
  "non_current_liability", // Long-term debt, bonds (2600+)
  // Equity sub-types
  "share_capital", // Share capital, contributed capital (3000-3099)
  "retained_earnings", // Accumulated profits (3200)
  "reserves", // Other reserves (3100, 3300+)
  // Revenue sub-types
  "operating_revenue", // Sales, service income (4000+)
  "other_income", // Interest income, gains (4900+)
  // Expense sub-types
  "cost_of_goods_sold", // COGS, direct costs (5000-5199)
  "operating_expense", // Salaries, rent, utilities (5200-5899)
  "other_expense", // Interest expense, losses (5900+)
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
  "payroll", // Payroll salary accrual and payment
  "payment", // Invoice/bill payment receipt
]);

// Payment enums
export const paymentTypeEnum = pgEnum("payment_type", [
  "invoice_payment", // AR - Customer pays us (reduces AR)
  "bill_payment", // AP - We pay vendor (reduces AP)
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer", // Direct bank transfer
  "cash", // Cash payment
  "check", // Cheque/check
  "credit_card", // Credit card payment
  "debit_card", // Debit card payment
  "online", // Online payment gateway
  "offset", // Credit note offset
  "other", // Other payment method
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending", // Payment recorded but not confirmed
  "completed", // Payment confirmed
  "failed", // Payment failed
  "cancelled", // Payment cancelled
  "refunded", // Payment refunded
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

// Payroll enums
export const employeeStatusEnum = pgEnum("employee_status", [
  "active", // Currently employed
  "probation", // On probation period
  "terminated", // Employment terminated
  "resigned", // Employee resigned
  "retired", // Employee retired
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time", // Full-time employee
  "part_time", // Part-time employee
  "contract", // Contract worker
  "intern", // Internship
]);

export const nationalityTypeEnum = pgEnum("nationality_type", [
  "malaysian", // Malaysian citizen
  "permanent_resident", // PR status
  "foreign", // Foreign worker
]);

export const salaryComponentTypeEnum = pgEnum("salary_component_type", [
  "earnings", // Adds to gross salary (allowances, bonuses)
  "deductions", // Reduces from gross salary (loans, advances)
]);

export const calculationMethodEnum = pgEnum("calculation_method", [
  "fixed", // Fixed amount
  "percentage", // Percentage of base salary
  "hourly", // Hourly rate × hours
  "daily", // Daily rate × days
]);

export const payFrequencyEnum = pgEnum("pay_frequency", [
  "monthly", // Paid once a month
  "bi_weekly", // Paid every two weeks
  "weekly", // Paid weekly
]);

export const payrollRunStatusEnum = pgEnum("payroll_run_status", [
  "draft", // Just created, not processed
  "calculating", // Calculation in progress
  "pending_review", // Calculated, awaiting review
  "approved", // Approved by manager/admin
  "finalized", // Locked, journal entry created
  "paid", // Salaries disbursed
  "cancelled", // Cancelled/voided
]);

export const paySlipStatusEnum = pgEnum("pay_slip_status", [
  "draft", // Created but not calculated
  "calculated", // Calculations complete
  "approved", // Approved for payment
  "paid", // Payment processed
  "cancelled", // Cancelled/voided
]);

export const statutoryContributionTypeEnum = pgEnum("statutory_contribution_type", [
  "epf_employer", // EPF employer contribution
  "epf_employee", // EPF employee contribution
  "socso_employer", // SOCSO employer contribution
  "socso_employee", // SOCSO employee contribution
  "eis_employer", // EIS employer contribution
  "eis_employee", // EIS employee contribution
]);

export const maritalStatusEnum = pgEnum("marital_status", [
  "single", // Never married
  "married", // Currently married
  "divorced", // Divorced
  "widowed", // Widowed
]);

// User action audit enums
export const userActionTypeEnum = pgEnum("user_action_type", [
  // Authentication actions
  "login", // User logged in
  "logout", // User logged out
  "password_change", // User changed password
  "password_reset", // User reset password
  "session_refresh", // Session was refreshed
  "mfa_enabled", // MFA was enabled
  "mfa_disabled", // MFA was disabled
  // Settings actions
  "settings_view", // User viewed settings
  "settings_update", // User updated settings
  "profile_update", // User updated profile
  "company_update", // User updated company info
  "notification_update", // User updated notification preferences
  "agent_settings_update", // User updated AI agent settings
  // Data export actions
  "export_invoices", // User exported invoices
  "export_customers", // User exported customers
  "export_vendors", // User exported vendors
  "export_bills", // User exported bills
  "export_reports", // User exported reports
  "export_audit_logs", // User exported audit logs
  // API key actions
  "api_key_created", // User created API key
  "api_key_revoked", // User revoked API key
  "api_key_viewed", // User viewed API key
  // Webhook actions
  "webhook_created", // User created webhook
  "webhook_updated", // User updated webhook
  "webhook_deleted", // User deleted webhook
  // Dangerous/admin actions
  "bulk_delete", // User performed bulk delete
  "data_import", // User imported data
  "account_deletion_request", // User requested account deletion
  // Security events
  "suspicious_activity", // Suspicious activity detected
  "rate_limit_exceeded", // User exceeded rate limit
  "invalid_access_attempt", // Invalid access attempt
]);
