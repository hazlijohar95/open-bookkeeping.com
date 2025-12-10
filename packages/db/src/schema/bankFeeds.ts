import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  jsonb,
  index,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { invoices } from "./invoices";
import { bills } from "./bills";
import { customers } from "./customers";
import { vendors } from "./vendors";
import {
  transactionTypeEnum,
  matchStatusEnum,
  transactionCategoryTypeEnum,
} from "./enums";

// Re-export enums for backward compatibility
export { transactionTypeEnum, matchStatusEnum, transactionCategoryTypeEnum };

// Bank accounts configured by the user
export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    accountName: text("account_name").notNull(),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    currency: text("currency").default("MYR").notNull(),

    // Opening balance for reconciliation
    openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default("0"),
    openingBalanceDate: timestamp("opening_balance_date"),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("bank_accounts_user_id_idx").on(table.userId),
  ]
);

// Uploaded bank statement files
export const bankStatementUploads = pgTable(
  "bank_statement_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id")
      .references(() => bankAccounts.id, { onDelete: "cascade" })
      .notNull(),

    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(), // csv, ofx
    bankPreset: text("bank_preset"), // maybank, cimb, public_bank, rhb, hong_leong

    // Import metadata
    transactionCount: integer("transaction_count"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bank_statement_uploads_user_id_idx").on(table.userId),
    index("bank_statement_uploads_bank_account_id_idx").on(table.bankAccountId),
  ]
);

// Individual bank transactions (imported from statements)
export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bankAccountId: uuid("bank_account_id")
      .references(() => bankAccounts.id, { onDelete: "cascade" })
      .notNull(),
    uploadId: uuid("upload_id").references(() => bankStatementUploads.id, {
      onDelete: "set null",
    }),

    // Transaction details
    transactionDate: timestamp("transaction_date").notNull(),
    description: text("description").notNull(),
    reference: text("reference"), // Check number, transfer ID, etc.

    // Amount (positive for deposits, negative for withdrawals stored as absolute value)
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    type: transactionTypeEnum("type").notNull(),

    // Running balance (if provided by bank)
    balance: numeric("balance", { precision: 15, scale: 2 }),

    // Reconciliation status
    matchStatus: matchStatusEnum("match_status").default("unmatched").notNull(),

    // Linked entities (when matched/reconciled)
    matchedInvoiceId: uuid("matched_invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    matchedBillId: uuid("matched_bill_id").references(() => bills.id, {
      onDelete: "set null",
    }),
    matchedCustomerId: uuid("matched_customer_id").references(
      () => customers.id,
      { onDelete: "set null" }
    ),
    matchedVendorId: uuid("matched_vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),

    // Category for non-invoice/bill transactions
    categoryId: uuid("category_id").references(() => transactionCategories.id, {
      onDelete: "set null",
    }),

    // Smart match confidence score (0-100)
    matchConfidence: numeric("match_confidence", { precision: 5, scale: 2 }),

    // Notes added by user
    notes: text("notes"),

    isReconciled: boolean("is_reconciled").default(false).notNull(),
    reconciledAt: timestamp("reconciled_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bank_transactions_user_id_idx").on(table.userId),
    index("bank_transactions_bank_account_id_idx").on(table.bankAccountId),
    index("bank_transactions_date_idx").on(table.transactionDate),
    index("bank_transactions_match_status_idx").on(table.matchStatus),
    // Composite index for filtering unmatched transactions by user
    index("bank_transactions_user_match_idx").on(table.userId, table.matchStatus),
  ]
);

// Transaction categories (for non-matched transactions)
export const transactionCategories = pgTable(
  "transaction_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    name: text("name").notNull(),
    type: transactionCategoryTypeEnum("type").notNull(),
    color: text("color"), // Hex color for UI display

    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("transaction_categories_user_id_idx").on(table.userId),
  ]
);

// Matching rules for auto-categorization
export const matchingRules = pgTable(
  "matching_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    name: text("name").notNull(),
    priority: integer("priority").default(100).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    // Rule conditions (stored as JSON for flexibility)
    conditions: jsonb("conditions")
      .$type<{
        descriptionContains?: string[];
        descriptionPattern?: string; // regex
        amountMin?: number;
        amountMax?: number;
        amountExact?: number;
        transactionType?: "deposit" | "withdrawal";
      }>()
      .notNull(),

    // Rule actions
    action: jsonb("action")
      .$type<{
        type: "match_customer" | "match_vendor" | "categorize";
        customerId?: string;
        vendorId?: string;
        categoryId?: string;
      }>()
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("matching_rules_user_id_idx").on(table.userId),
  ]
);

// Relations
export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [bankAccounts.userId],
    references: [users.id],
  }),
  uploads: many(bankStatementUploads),
  transactions: many(bankTransactions),
}));

export const bankStatementUploadsRelations = relations(
  bankStatementUploads,
  ({ one, many }) => ({
    user: one(users, {
      fields: [bankStatementUploads.userId],
      references: [users.id],
    }),
    bankAccount: one(bankAccounts, {
      fields: [bankStatementUploads.bankAccountId],
      references: [bankAccounts.id],
    }),
    transactions: many(bankTransactions),
  })
);

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [bankTransactions.userId],
      references: [users.id],
    }),
    bankAccount: one(bankAccounts, {
      fields: [bankTransactions.bankAccountId],
      references: [bankAccounts.id],
    }),
    upload: one(bankStatementUploads, {
      fields: [bankTransactions.uploadId],
      references: [bankStatementUploads.id],
    }),
    matchedInvoice: one(invoices, {
      fields: [bankTransactions.matchedInvoiceId],
      references: [invoices.id],
    }),
    matchedBill: one(bills, {
      fields: [bankTransactions.matchedBillId],
      references: [bills.id],
    }),
    matchedCustomer: one(customers, {
      fields: [bankTransactions.matchedCustomerId],
      references: [customers.id],
    }),
    matchedVendor: one(vendors, {
      fields: [bankTransactions.matchedVendorId],
      references: [vendors.id],
    }),
    category: one(transactionCategories, {
      fields: [bankTransactions.categoryId],
      references: [transactionCategories.id],
    }),
  })
);

export const transactionCategoriesRelations = relations(
  transactionCategories,
  ({ one, many }) => ({
    user: one(users, {
      fields: [transactionCategories.userId],
      references: [users.id],
    }),
    transactions: many(bankTransactions),
  })
);

export const matchingRulesRelations = relations(matchingRules, ({ one }) => ({
  user: one(users, {
    fields: [matchingRules.userId],
    references: [users.id],
  }),
}));

// TypeScript types
export type BankAccount = typeof bankAccounts.$inferSelect;
export type NewBankAccount = typeof bankAccounts.$inferInsert;
export type BankStatementUpload = typeof bankStatementUploads.$inferSelect;
export type NewBankStatementUpload = typeof bankStatementUploads.$inferInsert;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type NewBankTransaction = typeof bankTransactions.$inferInsert;
export type TransactionCategory = typeof transactionCategories.$inferSelect;
export type NewTransactionCategory = typeof transactionCategories.$inferInsert;
export type MatchingRule = typeof matchingRules.$inferSelect;
export type NewMatchingRule = typeof matchingRules.$inferInsert;
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];
export type MatchStatus = (typeof matchStatusEnum.enumValues)[number];
export type TransactionCategoryType = (typeof transactionCategoryTypeEnum.enumValues)[number];
