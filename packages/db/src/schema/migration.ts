/**
 * Migration & Opening Balance Schema
 * Handles data migration, opening balances, and onboarding setup
 */

import { pgTable, uuid, text, timestamp, boolean, numeric, date, jsonb, integer, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./chartOfAccounts";
import { employees } from "./payroll";

// Migration session status
export const migrationSessionStatusEnum = pgEnum("migration_session_status", [
  "draft",           // Just started, not complete
  "in_progress",     // User is actively working on it
  "validating",      // Running validation checks
  "validated",       // All validations passed
  "completed",       // Migration finalized
  "failed",          // Migration failed
]);

// Import type for different data types
export const importTypeEnum = pgEnum("import_type", [
  "chart_of_accounts",  // Chart of accounts import
  "opening_balances",   // Trial balance / opening balances
  "customers",          // Customer master data
  "vendors",            // Vendor master data
  "open_invoices",      // Outstanding AR
  "open_bills",         // Outstanding AP
  "bank_transactions",  // Historical bank transactions
  "employees",          // Employee master data
  "payroll_ytd",        // Year-to-date payroll figures
]);

// Source system presets
export const sourceSystemEnum = pgEnum("source_system", [
  "quickbooks",
  "xero",
  "sage",
  "wave",
  "zoho",
  "sql_accounting",
  "autocount",
  "custom",
]);

// Validation status for individual entries
export const validationStatusEnum = pgEnum("validation_status", [
  "pending",    // Not yet validated
  "valid",      // Passed all checks
  "warning",    // Has warnings but can proceed
  "error",      // Has errors, cannot proceed
]);

/**
 * Migration Sessions
 * Tracks the overall migration/setup wizard progress
 */
export const migrationSessions = pgTable("migration_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // Session info
  name: text("name").default("Data Migration"),
  status: migrationSessionStatusEnum("status").default("draft").notNull(),
  sourceSystem: sourceSystemEnum("source_system"),

  // Conversion date (cutover date)
  conversionDate: date("conversion_date"),
  financialYearStart: date("financial_year_start"),

  // Progress tracking
  currentStep: text("current_step"),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  totalSteps: integer("total_steps").default(7),

  // Validation summary
  validationStatus: validationStatusEnum("validation_status").default("pending"),
  validationResults: jsonb("validation_results").$type<{
    totalChecks: number;
    passed: number;
    warnings: number;
    errors: number;
    details: Array<{
      check: string;
      status: "pass" | "warning" | "error";
      message: string;
      action?: string;
    }>;
  }>(),

  // Trial balance verification
  totalDebits: numeric("total_debits", { precision: 15, scale: 2 }).default("0"),
  totalCredits: numeric("total_credits", { precision: 15, scale: 2 }).default("0"),
  isBalanced: boolean("is_balanced").default(false),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("migration_sessions_user_id_idx").on(table.userId),
  index("migration_sessions_status_idx").on(table.status),
]);

/**
 * Opening Balance Entries
 * Individual account opening balances for migration
 */
export const openingBalanceEntries = pgTable("opening_balance_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  migrationSessionId: uuid("migration_session_id").references(() => migrationSessions.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),

  // Account reference
  accountId: uuid("account_id").references(() => accounts.id),
  accountCode: text("account_code").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(), // asset, liability, equity, revenue, expense

  // Balances
  debitAmount: numeric("debit_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  creditAmount: numeric("credit_amount", { precision: 15, scale: 2 }).default("0").notNull(),

  // For subledger detail (AR/AP breakdown)
  hasSubledgerDetail: boolean("has_subledger_detail").default(false),

  // Validation
  validationStatus: validationStatusEnum("validation_status").default("pending"),
  validationErrors: jsonb("validation_errors").$type<string[]>(),

  // Auto-mapped or manual
  isAutoMapped: boolean("is_auto_mapped").default(false),
  mappingConfidence: numeric("mapping_confidence", { precision: 5, scale: 2 }), // 0.00 to 1.00

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("opening_balance_entries_session_idx").on(table.migrationSessionId),
  index("opening_balance_entries_user_idx").on(table.userId),
  index("opening_balance_entries_account_idx").on(table.accountId),
]);

/**
 * Opening Balance Subledger
 * Detailed AR/AP breakdown (individual invoices/bills)
 */
export const openingBalanceSubledger = pgTable("opening_balance_subledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  openingBalanceEntryId: uuid("opening_balance_entry_id").references(() => openingBalanceEntries.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),

  // Entity reference (customer or vendor)
  entityType: text("entity_type").notNull(), // "customer" or "vendor"
  entityId: uuid("entity_id"), // Reference to customer or vendor
  entityName: text("entity_name").notNull(),

  // Document details
  referenceNumber: text("reference_number").notNull(), // Original invoice/bill number
  documentDate: date("document_date"),
  dueDate: date("due_date"),

  // Amounts
  originalAmount: numeric("original_amount", { precision: 15, scale: 2 }).notNull(),
  outstandingAmount: numeric("outstanding_amount", { precision: 15, scale: 2 }).notNull(),

  // Currency
  currency: text("currency").default("MYR").notNull(),

  // Notes
  description: text("description"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("opening_balance_subledger_entry_idx").on(table.openingBalanceEntryId),
  index("opening_balance_subledger_entity_idx").on(table.entityType, table.entityId),
]);

/**
 * Import Templates
 * Saved column mapping configurations for reuse
 */
export const importTemplates = pgTable("import_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  name: text("name").notNull(),
  importType: importTypeEnum("import_type").notNull(),
  sourceSystem: sourceSystemEnum("source_system"),

  // Column mapping configuration
  columnMapping: jsonb("column_mapping").$type<Array<{
    sourceColumn: string;
    targetField: string;
    transform?: string; // e.g., "parseDate", "parseNumber", "uppercase"
    defaultValue?: string;
    required: boolean;
  }>>().notNull(),

  // File format settings
  hasHeaderRow: boolean("has_header_row").default(true),
  delimiter: text("delimiter").default(","),
  dateFormat: text("date_format").default("DD/MM/YYYY"),
  decimalSeparator: text("decimal_separator").default("."),

  // Usage stats
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("import_templates_user_idx").on(table.userId),
  index("import_templates_type_idx").on(table.importType),
  uniqueIndex("import_templates_user_name_idx").on(table.userId, table.name),
]);

/**
 * Import Jobs
 * Track individual import operations
 */
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  migrationSessionId: uuid("migration_session_id").references(() => migrationSessions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),

  importType: importTypeEnum("import_type").notNull(),
  templateId: uuid("template_id").references(() => importTemplates.id),

  // File info
  fileName: text("file_name"),
  fileSize: integer("file_size"),

  // Status
  status: text("status").default("pending").notNull(), // pending, processing, completed, failed

  // Progress
  totalRows: integer("total_rows").default(0),
  processedRows: integer("processed_rows").default(0),
  successRows: integer("success_rows").default(0),
  errorRows: integer("error_rows").default(0),

  // Results
  errors: jsonb("errors").$type<Array<{
    row: number;
    field?: string;
    value?: string;
    error: string;
  }>>(),

  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("import_jobs_session_idx").on(table.migrationSessionId),
  index("import_jobs_user_idx").on(table.userId),
  index("import_jobs_status_idx").on(table.status),
]);

/**
 * Payroll YTD Migration
 * Year-to-date payroll figures for mid-year migrations
 */
export const payrollYtdMigration = pgTable("payroll_ytd_migration", {
  id: uuid("id").primaryKey().defaultRandom(),
  migrationSessionId: uuid("migration_session_id").references(() => migrationSessions.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),

  // As of date
  asOfDate: date("as_of_date").notNull(),
  monthsWorked: integer("months_worked").default(0).notNull(),

  // YTD Earnings
  ytdGrossSalary: numeric("ytd_gross_salary", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdBaseSalary: numeric("ytd_base_salary", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdAllowances: numeric("ytd_allowances", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdOtherEarnings: numeric("ytd_other_earnings", { precision: 15, scale: 2 }).default("0").notNull(),

  // YTD Deductions
  ytdTotalDeductions: numeric("ytd_total_deductions", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdOtherDeductions: numeric("ytd_other_deductions", { precision: 15, scale: 2 }).default("0").notNull(),

  // YTD Statutory - Employee
  ytdEpfEmployee: numeric("ytd_epf_employee", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdSocsoEmployee: numeric("ytd_socso_employee", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdEisEmployee: numeric("ytd_eis_employee", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdPcb: numeric("ytd_pcb", { precision: 15, scale: 2 }).default("0").notNull(),

  // YTD Statutory - Employer
  ytdEpfEmployer: numeric("ytd_epf_employer", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdSocsoEmployer: numeric("ytd_socso_employer", { precision: 15, scale: 2 }).default("0").notNull(),
  ytdEisEmployer: numeric("ytd_eis_employer", { precision: 15, scale: 2 }).default("0").notNull(),

  // YTD Net
  ytdNetSalary: numeric("ytd_net_salary", { precision: 15, scale: 2 }).default("0").notNull(),

  // Validation
  validationStatus: validationStatusEnum("validation_status").default("pending"),
  validationErrors: jsonb("validation_errors").$type<string[]>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("payroll_ytd_migration_session_idx").on(table.migrationSessionId),
  index("payroll_ytd_migration_employee_idx").on(table.employeeId),
  uniqueIndex("payroll_ytd_migration_unique_idx").on(table.migrationSessionId, table.employeeId),
]);

/**
 * Account Mapping Suggestions
 * AI-generated account mapping suggestions
 */
export const accountMappingSuggestions = pgTable("account_mapping_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  migrationSessionId: uuid("migration_session_id").references(() => migrationSessions.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),

  // Source account (from import)
  sourceCode: text("source_code").notNull(),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type"), // Original type if available

  // Suggested target account
  targetAccountId: uuid("target_account_id").references(() => accounts.id),
  targetAccountCode: text("target_account_code"),
  targetAccountName: text("target_account_name"),

  // AI confidence
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(), // 0.00 to 1.00
  reasoning: text("reasoning"), // Why this mapping was suggested

  // User decision
  status: text("status").default("pending").notNull(), // pending, accepted, rejected, manual
  userSelectedAccountId: uuid("user_selected_account_id").references(() => accounts.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("account_mapping_suggestions_session_idx").on(table.migrationSessionId),
  index("account_mapping_suggestions_status_idx").on(table.status),
]);

/**
 * Demo Data Requests
 * Track demo data generation for users exploring the system
 */
export const demoDataRequests = pgTable("demo_data_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // What was generated
  options: jsonb("options").$type<{
    customers: number;
    vendors: number;
    invoices: number;
    bills: number;
    bankTransactions: number;
    employees: number;
    dateRange: string; // e.g., "3months", "6months", "1year"
  }>().notNull(),

  // Result counts
  generatedCounts: jsonb("generated_counts").$type<Record<string, number>>(),

  // Status
  status: text("status").default("pending").notNull(), // pending, processing, completed, failed
  error: text("error"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("demo_data_requests_user_idx").on(table.userId),
]);

// Relations
export const migrationSessionsRelations = relations(migrationSessions, ({ many }) => ({
  openingBalanceEntries: many(openingBalanceEntries),
  importJobs: many(importJobs),
  payrollYtdMigration: many(payrollYtdMigration),
  accountMappingSuggestions: many(accountMappingSuggestions),
}));

export const openingBalanceEntriesRelations = relations(openingBalanceEntries, ({ one, many }) => ({
  migrationSession: one(migrationSessions, {
    fields: [openingBalanceEntries.migrationSessionId],
    references: [migrationSessions.id],
  }),
  account: one(accounts, {
    fields: [openingBalanceEntries.accountId],
    references: [accounts.id],
  }),
  subledgerItems: many(openingBalanceSubledger),
}));

export const openingBalanceSubledgerRelations = relations(openingBalanceSubledger, ({ one }) => ({
  openingBalanceEntry: one(openingBalanceEntries, {
    fields: [openingBalanceSubledger.openingBalanceEntryId],
    references: [openingBalanceEntries.id],
  }),
}));

export const importJobsRelations = relations(importJobs, ({ one }) => ({
  migrationSession: one(migrationSessions, {
    fields: [importJobs.migrationSessionId],
    references: [migrationSessions.id],
  }),
  template: one(importTemplates, {
    fields: [importJobs.templateId],
    references: [importTemplates.id],
  }),
}));

export const payrollYtdMigrationRelations = relations(payrollYtdMigration, ({ one }) => ({
  migrationSession: one(migrationSessions, {
    fields: [payrollYtdMigration.migrationSessionId],
    references: [migrationSessions.id],
  }),
  employee: one(employees, {
    fields: [payrollYtdMigration.employeeId],
    references: [employees.id],
  }),
}));

export const accountMappingSuggestionsRelations = relations(accountMappingSuggestions, ({ one }) => ({
  migrationSession: one(migrationSessions, {
    fields: [accountMappingSuggestions.migrationSessionId],
    references: [migrationSessions.id],
  }),
  targetAccount: one(accounts, {
    fields: [accountMappingSuggestions.targetAccountId],
    references: [accounts.id],
  }),
  userSelectedAccount: one(accounts, {
    fields: [accountMappingSuggestions.userSelectedAccountId],
    references: [accounts.id],
  }),
}));

// Type exports
export type MigrationSession = typeof migrationSessions.$inferSelect;
export type NewMigrationSession = typeof migrationSessions.$inferInsert;
export type OpeningBalanceEntry = typeof openingBalanceEntries.$inferSelect;
export type NewOpeningBalanceEntry = typeof openingBalanceEntries.$inferInsert;
export type OpeningBalanceSubledgerItem = typeof openingBalanceSubledger.$inferSelect;
export type NewOpeningBalanceSubledgerItem = typeof openingBalanceSubledger.$inferInsert;
export type ImportTemplate = typeof importTemplates.$inferSelect;
export type NewImportTemplate = typeof importTemplates.$inferInsert;
export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
export type PayrollYtdMigration = typeof payrollYtdMigration.$inferSelect;
export type NewPayrollYtdMigration = typeof payrollYtdMigration.$inferInsert;
export type AccountMappingSuggestion = typeof accountMappingSuggestions.$inferSelect;
export type NewAccountMappingSuggestion = typeof accountMappingSuggestions.$inferInsert;
export type DemoDataRequest = typeof demoDataRequests.$inferSelect;
export type NewDemoDataRequest = typeof demoDataRequests.$inferInsert;
