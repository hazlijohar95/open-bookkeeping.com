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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import {
  accountTypeEnum,
  accountSubTypeEnum,
  normalBalanceEnum,
  journalEntryStatusEnum,
  sourceDocumentTypeEnum,
  sstTaxCodeEnum,
  accountingPeriodStatusEnum,
} from "./enums";

// Re-export enums for convenience
export {
  accountTypeEnum,
  accountSubTypeEnum,
  normalBalanceEnum,
  journalEntryStatusEnum,
  sourceDocumentTypeEnum,
  sstTaxCodeEnum,
  accountingPeriodStatusEnum,
};

// Chart of Accounts - the foundational ledger accounts
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Account identification
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Account classification
    accountType: accountTypeEnum("account_type").notNull(),
    subType: accountSubTypeEnum("sub_type"), // For flexible categorization (COGS, operating, etc.)
    normalBalance: normalBalanceEnum("normal_balance").notNull(),

    // Hierarchy (self-referential for parent/child)
    parentId: uuid("parent_id").references((): any => accounts.id, {
      onDelete: "set null",
    }),
    level: integer("level").default(0).notNull(), // 0 = root, 1 = child, etc.
    path: text("path"), // Materialized path: "1000/1010/1011"

    // Tax settings (Malaysian SST)
    sstTaxCode: sstTaxCodeEnum("sst_tax_code").default("none"),

    // Account flags
    isActive: boolean("is_active").default(true).notNull(),
    isSystemAccount: boolean("is_system_account").default(false).notNull(), // Cannot delete (AR, AP)
    isHeader: boolean("is_header").default(false).notNull(), // No posting allowed

    // Opening balance (for migrations/setup)
    openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default("0"),
    openingBalanceDate: date("opening_balance_date"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    index("accounts_code_idx").on(table.code),
    index("accounts_account_type_idx").on(table.accountType),
    index("accounts_parent_id_idx").on(table.parentId),
    unique("accounts_user_code_unique").on(table.userId, table.code),
  ]
);

// Journal Entries - the core of double-entry bookkeeping
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Entry identification
    entryNumber: varchar("entry_number", { length: 30 }).notNull(), // JE-2024-00001
    entryDate: date("entry_date").notNull(),

    // Entry details
    description: text("description").notNull(),
    reference: varchar("reference", { length: 100 }), // External reference

    // Status workflow
    status: journalEntryStatusEnum("status").default("draft").notNull(),

    // Source document link (for auto-generated entries)
    sourceType: sourceDocumentTypeEnum("source_type"),
    sourceId: uuid("source_id"), // Link to invoice, bill, bank_transaction

    // For reversals
    reversedEntryId: uuid("reversed_entry_id").references(
      (): any => journalEntries.id,
      { onDelete: "set null" }
    ),

    // Calculated totals (for quick reference)
    totalDebit: numeric("total_debit", { precision: 15, scale: 2 }).default("0").notNull(),
    totalCredit: numeric("total_credit", { precision: 15, scale: 2 }).default("0").notNull(),

    // Audit trail
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),

    // Timestamps
    postedAt: timestamp("posted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("journal_entries_user_id_idx").on(table.userId),
    index("journal_entries_entry_date_idx").on(table.entryDate),
    index("journal_entries_status_idx").on(table.status),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    unique("journal_entries_user_number_unique").on(table.userId, table.entryNumber),
  ]
);

// Journal Entry Lines - individual debit/credit lines
export const journalEntryLines = pgTable(
  "journal_entry_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journalEntryId: uuid("journal_entry_id")
      .references(() => journalEntries.id, { onDelete: "cascade" })
      .notNull(),
    accountId: uuid("account_id")
      .references(() => accounts.id, { onDelete: "restrict" })
      .notNull(),

    // Line order
    lineNumber: integer("line_number").default(1).notNull(),

    // Amounts (one or the other, stored as positive values)
    debitAmount: numeric("debit_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    creditAmount: numeric("credit_amount", { precision: 15, scale: 2 }).default("0").notNull(),

    // Tax information
    sstTaxCode: sstTaxCodeEnum("sst_tax_code"),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }),

    // Line description (optional, defaults to entry description)
    description: text("description"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("journal_entry_lines_entry_id_idx").on(table.journalEntryId),
    index("journal_entry_lines_account_id_idx").on(table.accountId),
    // Composite index for date-based account balance queries
    index("journal_entry_lines_account_created_idx").on(table.accountId, table.createdAt),
  ]
);

// Account Balances - cached period balances for performance
export const accountBalances = pgTable(
  "account_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .references(() => accounts.id, { onDelete: "cascade" })
      .notNull(),

    // Period
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12

    // Balance components
    openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default("0").notNull(),
    periodDebit: numeric("period_debit", { precision: 15, scale: 2 }).default("0").notNull(),
    periodCredit: numeric("period_credit", { precision: 15, scale: 2 }).default("0").notNull(),
    closingBalance: numeric("closing_balance", { precision: 15, scale: 2 }).default("0").notNull(),

    // Cache tracking
    calculatedAt: timestamp("calculated_at"),

    // Timestamps
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("account_balances_account_id_idx").on(table.accountId),
    index("account_balances_period_idx").on(table.year, table.month),
    unique("account_balances_account_period_unique").on(
      table.accountId,
      table.year,
      table.month
    ),
  ]
);

// Accounting Periods - control posting dates and period closing
export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Period identification
    year: integer("year").notNull(),
    month: integer("month").notNull(), // 1-12

    // Period status
    status: accountingPeriodStatusEnum("status").default("open").notNull(),

    // Closing audit trail
    closedAt: timestamp("closed_at"),
    closedBy: uuid("closed_by").references(() => users.id),
    reopenedAt: timestamp("reopened_at"),
    reopenedBy: uuid("reopened_by").references(() => users.id),
    reopenReason: text("reopen_reason"),

    // Notes
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("accounting_periods_user_idx").on(table.userId),
    index("accounting_periods_year_idx").on(table.year),
    unique("accounting_periods_user_period_unique").on(table.userId, table.year, table.month),
  ]
);

// Ledger Transactions - denormalized view for fast General Ledger queries
export const ledgerTransactions = pgTable(
  "ledger_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    accountId: uuid("account_id")
      .references(() => accounts.id, { onDelete: "cascade" })
      .notNull(),
    journalEntryId: uuid("journal_entry_id")
      .references(() => journalEntries.id, { onDelete: "cascade" })
      .notNull(),
    journalEntryLineId: uuid("journal_entry_line_id")
      .references(() => journalEntryLines.id, { onDelete: "cascade" })
      .notNull(),

    // Denormalized data for fast queries
    transactionDate: date("transaction_date").notNull(),
    entryNumber: varchar("entry_number", { length: 30 }).notNull(),
    description: text("description"),
    reference: varchar("reference", { length: 100 }),
    sourceType: sourceDocumentTypeEnum("source_type"),
    sourceId: uuid("source_id"),

    // Amounts
    debitAmount: numeric("debit_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    creditAmount: numeric("credit_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    runningBalance: numeric("running_balance", { precision: 15, scale: 2 }).notNull(),

    // Account metadata for reporting
    accountCode: varchar("account_code", { length: 20 }).notNull(),
    accountName: varchar("account_name", { length: 100 }).notNull(),
    accountType: accountTypeEnum("account_type").notNull(),
    normalBalance: normalBalanceEnum("normal_balance").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ledger_transactions_user_account_idx").on(table.userId, table.accountId),
    index("ledger_transactions_date_idx").on(table.transactionDate),
    index("ledger_transactions_account_date_idx").on(table.accountId, table.transactionDate),
    index("ledger_transactions_source_idx").on(table.sourceType, table.sourceId),
    index("ledger_transactions_entry_idx").on(table.journalEntryId),
  ]
);

// Relations
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: "parentChild",
  }),
  children: many(accounts, { relationName: "parentChild" }),
  journalEntryLines: many(journalEntryLines),
  balances: many(accountBalances),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [journalEntries.userId],
    references: [users.id],
  }),
  lines: many(journalEntryLines),
  reversedEntry: one(journalEntries, {
    fields: [journalEntries.reversedEntryId],
    references: [journalEntries.id],
    relationName: "reversal",
  }),
  reversalOf: many(journalEntries, { relationName: "reversal" }),
  // Audit trail relations
  createdByUser: one(users, {
    fields: [journalEntries.createdBy],
    references: [users.id],
    relationName: "createdBy",
  }),
  updatedByUser: one(users, {
    fields: [journalEntries.updatedBy],
    references: [users.id],
    relationName: "updatedBy",
  }),
  postedByUser: one(users, {
    fields: [journalEntries.postedBy],
    references: [users.id],
    relationName: "postedBy",
  }),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalEntryLines.accountId],
    references: [accounts.id],
  }),
}));

export const accountBalancesRelations = relations(accountBalances, ({ one }) => ({
  account: one(accounts, {
    fields: [accountBalances.accountId],
    references: [accounts.id],
  }),
}));

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one }) => ({
  user: one(users, {
    fields: [accountingPeriods.userId],
    references: [users.id],
  }),
  closedByUser: one(users, {
    fields: [accountingPeriods.closedBy],
    references: [users.id],
    relationName: "closedBy",
  }),
  reopenedByUser: one(users, {
    fields: [accountingPeriods.reopenedBy],
    references: [users.id],
    relationName: "reopenedBy",
  }),
}));

export const ledgerTransactionsRelations = relations(ledgerTransactions, ({ one }) => ({
  user: one(users, {
    fields: [ledgerTransactions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [ledgerTransactions.accountId],
    references: [accounts.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [ledgerTransactions.journalEntryId],
    references: [journalEntries.id],
  }),
  journalEntryLine: one(journalEntryLines, {
    fields: [ledgerTransactions.journalEntryLineId],
    references: [journalEntryLines.id],
  }),
}));

// TypeScript types
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type NewJournalEntryLine = typeof journalEntryLines.$inferInsert;
export type AccountBalance = typeof accountBalances.$inferSelect;
export type NewAccountBalance = typeof accountBalances.$inferInsert;
export type AccountingPeriod = typeof accountingPeriods.$inferSelect;
export type NewAccountingPeriod = typeof accountingPeriods.$inferInsert;
export type LedgerTransaction = typeof ledgerTransactions.$inferSelect;
export type NewLedgerTransaction = typeof ledgerTransactions.$inferInsert;

// Enum types
export type AccountType = (typeof accountTypeEnum.enumValues)[number];
export type AccountSubType = (typeof accountSubTypeEnum.enumValues)[number];
export type NormalBalance = (typeof normalBalanceEnum.enumValues)[number];
export type JournalEntryStatus = (typeof journalEntryStatusEnum.enumValues)[number];
export type SourceDocumentType = (typeof sourceDocumentTypeEnum.enumValues)[number];
export type SstTaxCode = (typeof sstTaxCodeEnum.enumValues)[number];
export type AccountingPeriodStatus = (typeof accountingPeriodStatusEnum.enumValues)[number];
