import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  index,
  boolean,
  integer,
  varchar,
  date,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { journalEntries } from "./chartOfAccounts";
import {
  employeeStatusEnum,
  employmentTypeEnum,
  nationalityTypeEnum,
  salaryComponentTypeEnum,
  calculationMethodEnum,
  payFrequencyEnum,
  payrollRunStatusEnum,
  paySlipStatusEnum,
  statutoryContributionTypeEnum,
  maritalStatusEnum,
} from "./enums";

// Re-export enums for convenience
export {
  employeeStatusEnum,
  employmentTypeEnum,
  nationalityTypeEnum,
  salaryComponentTypeEnum,
  calculationMethodEnum,
  payFrequencyEnum,
  payrollRunStatusEnum,
  paySlipStatusEnum,
  statutoryContributionTypeEnum,
  maritalStatusEnum,
};

// ============================================================================
// EMPLOYEES - Core employee master data
// ============================================================================
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Employee identification
    employeeCode: varchar("employee_code", { length: 20 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }),

    // Malaysian ID / Passport
    icNumber: varchar("ic_number", { length: 20 }), // Malaysian IC (e.g., 901231-14-5678)
    passportNumber: varchar("passport_number", { length: 30 }), // For foreign workers

    // Contact info
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),

    // Employment details
    status: employeeStatusEnum("status").default("active").notNull(),
    employmentType: employmentTypeEnum("employment_type").default("full_time").notNull(),
    nationality: nationalityTypeEnum("nationality").default("malaysian").notNull(),

    // Important dates
    dateOfBirth: date("date_of_birth"),
    dateJoined: date("date_joined").notNull(),
    dateResigned: date("date_resigned"),
    probationEndDate: date("probation_end_date"),

    // Organization
    department: varchar("department", { length: 100 }),
    position: varchar("position", { length: 100 }),

    // Bank details for salary payment
    bankName: varchar("bank_name", { length: 100 }),
    bankAccountNumber: varchar("bank_account_number", { length: 30 }),
    bankAccountHolder: varchar("bank_account_holder", { length: 100 }),

    // Tax information
    taxNumber: varchar("tax_number", { length: 20 }), // PCB/MTD tax file number

    // Tax relief - for PCB calculation
    maritalStatus: maritalStatusEnum("marital_status").default("single"),
    spouseWorking: boolean("spouse_working").default(true), // If married, is spouse employed?
    numberOfChildren: integer("number_of_children").default(0),
    childrenInUniversity: integer("children_in_university").default(0),
    disabledChildren: integer("disabled_children").default(0),

    // Statutory registration numbers
    epfNumber: varchar("epf_number", { length: 20 }), // KWSP member number
    socsoNumber: varchar("socso_number", { length: 20 }), // PERKESO number
    eisNumber: varchar("eis_number", { length: 20 }), // SIP number

    // Optional EPF rate overrides (null = use default rates)
    epfEmployeeRate: numeric("epf_employee_rate", { precision: 5, scale: 2 }),
    epfEmployerRate: numeric("epf_employer_rate", { precision: 5, scale: 2 }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"), // Soft delete for compliance
  },
  (table) => [
    index("employees_user_id_idx").on(table.userId),
    index("employees_status_idx").on(table.status),
    index("employees_department_idx").on(table.department),
    unique("employees_user_code_unique").on(table.userId, table.employeeCode),
    index("employees_user_deleted_idx").on(table.userId, table.deletedAt),
    index("employees_ic_number_idx").on(table.icNumber),
  ]
);

// ============================================================================
// EMPLOYEE SALARIES - Salary history with effective dates
// ============================================================================
export const employeeSalaries = pgTable(
  "employee_salaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .references(() => employees.id, { onDelete: "cascade" })
      .notNull(),

    // Effective period
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"), // null = current salary

    // Base salary
    baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("MYR").notNull(),
    payFrequency: payFrequencyEnum("pay_frequency").default("monthly").notNull(),

    // Notes about salary change
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("employee_salaries_employee_id_idx").on(table.employeeId),
    index("employee_salaries_effective_from_idx").on(table.effectiveFrom),
    // Ensure only one active salary per employee at a time
    index("employee_salaries_employee_effective_idx").on(
      table.employeeId,
      table.effectiveFrom,
      table.effectiveTo
    ),
  ]
);

// ============================================================================
// SALARY COMPONENTS - User-defined earnings and deductions types
// ============================================================================
export const salaryComponents = pgTable(
  "salary_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Component identification
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Component type and calculation
    componentType: salaryComponentTypeEnum("component_type").notNull(),
    calculationMethod: calculationMethodEnum("calculation_method").default("fixed").notNull(),

    // Default values
    defaultAmount: numeric("default_amount", { precision: 15, scale: 2 }),
    defaultPercentage: numeric("default_percentage", { precision: 5, scale: 2 }),

    // Statutory contribution applicability
    isEpfApplicable: boolean("is_epf_applicable").default(true).notNull(),
    isSocsoApplicable: boolean("is_socso_applicable").default(true).notNull(),
    isEisApplicable: boolean("is_eis_applicable").default(true).notNull(),
    isPcbApplicable: boolean("is_pcb_applicable").default(true).notNull(),

    // Display
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("salary_components_user_id_idx").on(table.userId),
    index("salary_components_type_idx").on(table.componentType),
    unique("salary_components_user_code_unique").on(table.userId, table.code),
  ]
);

// ============================================================================
// PAYROLL RUNS - Monthly/periodic payroll batches
// ============================================================================
export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Run identification
    runNumber: varchar("run_number", { length: 30 }).notNull(), // PR-2024-01
    name: varchar("name", { length: 100 }), // "January 2024 Payroll"

    // Pay period
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(), // 1-12
    payDate: date("pay_date").notNull(),
    periodStartDate: date("period_start_date").notNull(),
    periodEndDate: date("period_end_date").notNull(),

    // Status workflow
    status: payrollRunStatusEnum("status").default("draft").notNull(),

    // Summary totals (calculated)
    totalEmployees: integer("total_employees").default(0),
    totalGrossSalary: numeric("total_gross_salary", { precision: 15, scale: 2 }).default("0"),
    totalDeductions: numeric("total_deductions", { precision: 15, scale: 2 }).default("0"),
    totalNetSalary: numeric("total_net_salary", { precision: 15, scale: 2 }).default("0"),

    // Statutory totals
    totalEpfEmployer: numeric("total_epf_employer", { precision: 15, scale: 2 }).default("0"),
    totalEpfEmployee: numeric("total_epf_employee", { precision: 15, scale: 2 }).default("0"),
    totalSocsoEmployer: numeric("total_socso_employer", { precision: 15, scale: 2 }).default("0"),
    totalSocsoEmployee: numeric("total_socso_employee", { precision: 15, scale: 2 }).default("0"),
    totalEisEmployer: numeric("total_eis_employer", { precision: 15, scale: 2 }).default("0"),
    totalEisEmployee: numeric("total_eis_employee", { precision: 15, scale: 2 }).default("0"),
    totalPcb: numeric("total_pcb", { precision: 15, scale: 2 }).default("0"),

    // Accounting integration
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, {
      onDelete: "set null",
    }),

    // Audit trail
    calculatedAt: timestamp("calculated_at"),
    calculatedBy: uuid("calculated_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    approvedBy: uuid("approved_by").references(() => users.id),
    finalizedAt: timestamp("finalized_at"),
    finalizedBy: uuid("finalized_by").references(() => users.id),
    paidAt: timestamp("paid_at"),
    paidBy: uuid("paid_by").references(() => users.id),

    // Notes
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("payroll_runs_user_id_idx").on(table.userId),
    index("payroll_runs_status_idx").on(table.status),
    index("payroll_runs_period_idx").on(table.periodYear, table.periodMonth),
    unique("payroll_runs_user_number_unique").on(table.userId, table.runNumber),
    unique("payroll_runs_user_period_unique").on(table.userId, table.periodYear, table.periodMonth),
  ]
);

// ============================================================================
// PAY SLIPS - Individual employee pay records per payroll run
// ============================================================================
export const paySlips = pgTable(
  "pay_slips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payrollRunId: uuid("payroll_run_id")
      .references(() => payrollRuns.id, { onDelete: "cascade" })
      .notNull(),
    employeeId: uuid("employee_id")
      .references(() => employees.id, { onDelete: "restrict" })
      .notNull(),

    // Slip identification
    slipNumber: varchar("slip_number", { length: 30 }).notNull(), // PS-2024-01-001

    // Employee snapshot (at time of payroll for audit)
    employeeCode: varchar("employee_code", { length: 20 }).notNull(),
    employeeName: varchar("employee_name", { length: 200 }).notNull(),
    department: varchar("department", { length: 100 }),
    position: varchar("position", { length: 100 }),
    icNumber: varchar("ic_number", { length: 20 }),
    bankName: varchar("bank_name", { length: 100 }),
    bankAccountNumber: varchar("bank_account_number", { length: 30 }),

    // Salary basis
    baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).notNull(),
    workingDays: integer("working_days").default(0),
    daysWorked: integer("days_worked").default(0),

    // Calculated totals
    totalEarnings: numeric("total_earnings", { precision: 15, scale: 2 }).default("0").notNull(),
    grossSalary: numeric("gross_salary", { precision: 15, scale: 2 }).notNull(),

    // EPF (KWSP)
    epfEmployee: numeric("epf_employee", { precision: 15, scale: 2 }).default("0").notNull(),
    epfEmployer: numeric("epf_employer", { precision: 15, scale: 2 }).default("0").notNull(),
    epfWage: numeric("epf_wage", { precision: 15, scale: 2 }).default("0"), // Wage used for EPF calc

    // SOCSO (PERKESO)
    socsoEmployee: numeric("socso_employee", { precision: 15, scale: 2 }).default("0").notNull(),
    socsoEmployer: numeric("socso_employer", { precision: 15, scale: 2 }).default("0").notNull(),
    socsoWage: numeric("socso_wage", { precision: 15, scale: 2 }).default("0"),

    // EIS (SIP)
    eisEmployee: numeric("eis_employee", { precision: 15, scale: 2 }).default("0").notNull(),
    eisEmployer: numeric("eis_employer", { precision: 15, scale: 2 }).default("0").notNull(),
    eisWage: numeric("eis_wage", { precision: 15, scale: 2 }).default("0"),

    // PCB (MTD)
    pcb: numeric("pcb", { precision: 15, scale: 2 }).default("0").notNull(),
    pcbWage: numeric("pcb_wage", { precision: 15, scale: 2 }).default("0"),

    // Final amounts
    totalDeductions: numeric("total_deductions", { precision: 15, scale: 2 }).default("0").notNull(),
    netSalary: numeric("net_salary", { precision: 15, scale: 2 }).notNull(),

    // Year-to-date (for tax purposes)
    ytdGrossSalary: numeric("ytd_gross_salary", { precision: 15, scale: 2 }).default("0"),
    ytdEpfEmployee: numeric("ytd_epf_employee", { precision: 15, scale: 2 }).default("0"),
    ytdPcb: numeric("ytd_pcb", { precision: 15, scale: 2 }).default("0"),

    // Status
    status: paySlipStatusEnum("status").default("draft").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pay_slips_payroll_run_id_idx").on(table.payrollRunId),
    index("pay_slips_employee_id_idx").on(table.employeeId),
    index("pay_slips_status_idx").on(table.status),
    unique("pay_slips_run_employee_unique").on(table.payrollRunId, table.employeeId),
    unique("pay_slips_number_unique").on(table.slipNumber),
  ]
);

// ============================================================================
// PAY SLIP ITEMS - Line items for earnings and deductions
// ============================================================================
export const paySlipItems = pgTable(
  "pay_slip_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paySlipId: uuid("pay_slip_id")
      .references(() => paySlips.id, { onDelete: "cascade" })
      .notNull(),
    salaryComponentId: uuid("salary_component_id").references(() => salaryComponents.id, {
      onDelete: "set null",
    }),

    // Component snapshot
    componentCode: varchar("component_code", { length: 20 }).notNull(),
    componentName: varchar("component_name", { length: 100 }).notNull(),
    componentType: salaryComponentTypeEnum("component_type").notNull(),

    // Amount
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    calculationDetails: jsonb("calculation_details").$type<{
      method: string;
      baseAmount?: string;
      percentage?: string;
      hours?: number;
      days?: number;
      rate?: string;
    }>(),

    // Statutory flags (snapshot)
    isEpfApplicable: boolean("is_epf_applicable").default(true).notNull(),
    isSocsoApplicable: boolean("is_socso_applicable").default(true).notNull(),
    isEisApplicable: boolean("is_eis_applicable").default(true).notNull(),
    isPcbApplicable: boolean("is_pcb_applicable").default(true).notNull(),

    // Display
    sortOrder: integer("sort_order").default(0),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("pay_slip_items_pay_slip_id_idx").on(table.paySlipId),
    index("pay_slip_items_component_id_idx").on(table.salaryComponentId),
  ]
);

// ============================================================================
// STATUTORY CONTRIBUTION TABLES - EPF/SOCSO/EIS rate tables
// ============================================================================
export const statutoryContributionTables = pgTable(
  "statutory_contribution_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Table type
    contributionType: statutoryContributionTypeEnum("contribution_type").notNull(),

    // Effective period
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"), // null = currently active

    // Wage range (for table-based lookups)
    wageFrom: numeric("wage_from", { precision: 15, scale: 2 }).notNull(),
    wageTo: numeric("wage_to", { precision: 15, scale: 2 }).notNull(),

    // Contribution amount (table-based) or rate (percentage-based)
    contributionAmount: numeric("contribution_amount", { precision: 15, scale: 2 }),
    contributionRate: numeric("contribution_rate", { precision: 5, scale: 4 }), // e.g., 0.1100 = 11%

    // Conditions (JSON for flexibility)
    conditions: jsonb("conditions").$type<{
      ageCategory?: "under_60" | "60_and_above";
      nationality?: "malaysian" | "permanent_resident" | "foreign";
      salaryCategory?: "5000_and_below" | "above_5000";
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("statutory_tables_type_idx").on(table.contributionType),
    index("statutory_tables_effective_idx").on(table.effectiveFrom, table.effectiveTo),
    index("statutory_tables_wage_idx").on(table.wageFrom, table.wageTo),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  salaries: many(employeeSalaries),
  paySlips: many(paySlips),
}));

export const employeeSalariesRelations = relations(employeeSalaries, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeSalaries.employeeId],
    references: [employees.id],
  }),
}));

export const salaryComponentsRelations = relations(salaryComponents, ({ one, many }) => ({
  user: one(users, {
    fields: [salaryComponents.userId],
    references: [users.id],
  }),
  paySlipItems: many(paySlipItems),
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [payrollRuns.userId],
    references: [users.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [payrollRuns.journalEntryId],
    references: [journalEntries.id],
  }),
  calculatedByUser: one(users, {
    fields: [payrollRuns.calculatedBy],
    references: [users.id],
    relationName: "calculatedBy",
  }),
  approvedByUser: one(users, {
    fields: [payrollRuns.approvedBy],
    references: [users.id],
    relationName: "approvedBy",
  }),
  finalizedByUser: one(users, {
    fields: [payrollRuns.finalizedBy],
    references: [users.id],
    relationName: "finalizedBy",
  }),
  paidByUser: one(users, {
    fields: [payrollRuns.paidBy],
    references: [users.id],
    relationName: "paidBy",
  }),
  paySlips: many(paySlips),
}));

export const paySlipsRelations = relations(paySlips, ({ one, many }) => ({
  payrollRun: one(payrollRuns, {
    fields: [paySlips.payrollRunId],
    references: [payrollRuns.id],
  }),
  employee: one(employees, {
    fields: [paySlips.employeeId],
    references: [employees.id],
  }),
  items: many(paySlipItems),
}));

export const paySlipItemsRelations = relations(paySlipItems, ({ one }) => ({
  paySlip: one(paySlips, {
    fields: [paySlipItems.paySlipId],
    references: [paySlips.id],
  }),
  salaryComponent: one(salaryComponents, {
    fields: [paySlipItems.salaryComponentId],
    references: [salaryComponents.id],
  }),
}));

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type EmployeeSalary = typeof employeeSalaries.$inferSelect;
export type NewEmployeeSalary = typeof employeeSalaries.$inferInsert;
export type SalaryComponent = typeof salaryComponents.$inferSelect;
export type NewSalaryComponent = typeof salaryComponents.$inferInsert;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type NewPayrollRun = typeof payrollRuns.$inferInsert;
export type PaySlip = typeof paySlips.$inferSelect;
export type NewPaySlip = typeof paySlips.$inferInsert;
export type PaySlipItem = typeof paySlipItems.$inferSelect;
export type NewPaySlipItem = typeof paySlipItems.$inferInsert;
export type StatutoryContributionTable = typeof statutoryContributionTables.$inferSelect;
export type NewStatutoryContributionTable = typeof statutoryContributionTables.$inferInsert;

// Enum types
export type EmployeeStatus = (typeof employeeStatusEnum.enumValues)[number];
export type EmploymentType = (typeof employmentTypeEnum.enumValues)[number];
export type NationalityType = (typeof nationalityTypeEnum.enumValues)[number];
export type SalaryComponentType = (typeof salaryComponentTypeEnum.enumValues)[number];
export type CalculationMethod = (typeof calculationMethodEnum.enumValues)[number];
export type PayFrequency = (typeof payFrequencyEnum.enumValues)[number];
export type PayrollRunStatus = (typeof payrollRunStatusEnum.enumValues)[number];
export type PaySlipStatus = (typeof paySlipStatusEnum.enumValues)[number];
export type StatutoryContributionType = (typeof statutoryContributionTypeEnum.enumValues)[number];
export type MaritalStatus = (typeof maritalStatusEnum.enumValues)[number];
