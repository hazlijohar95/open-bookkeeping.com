import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  index,
  date,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { customers } from "./customers";
import { vendors } from "./vendors";
import { invoices } from "./invoices";
import { bills } from "./bills";
import { creditNotes } from "./creditNotes";
import { debitNotes } from "./debitNotes";
import { accounts, journalEntries } from "./chartOfAccounts";
import { bankTransactions } from "./bankFeeds";
import {
  paymentTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
} from "./enums";

// Re-export enums for convenience
export { paymentTypeEnum, paymentMethodEnum, paymentStatusEnum };

/**
 * Payments Table
 *
 * Tracks all payments received (AR) and made (AP).
 * Each payment creates a journal entry:
 *
 * Invoice Payment (AR):
 *   DR Cash/Bank         xxx
 *   CR Accounts Receivable   xxx
 *
 * Bill Payment (AP):
 *   DR Accounts Payable  xxx
 *   CR Cash/Bank             xxx
 *
 * With WHT (Withholding Tax):
 *   DR Cash/Bank         xxx
 *   DR WHT Receivable    xxx (if invoice payment with WHT deducted by customer)
 *   CR Accounts Receivable   xxx
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Payment identification
    paymentNumber: varchar("payment_number", { length: 30 }).notNull(),
    paymentType: paymentTypeEnum("payment_type").notNull(),

    // Customer/Vendor (one or the other based on payment type)
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),

    // Payment details
    paymentDate: date("payment_date").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    reference: varchar("reference", { length: 100 }), // Check number, transfer ref, etc.

    // Amounts
    currency: varchar("currency", { length: 3 }).default("MYR").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(), // Total payment amount

    // Withholding Tax (Malaysian WHT - for non-resident payments)
    whtAmount: numeric("wht_amount", { precision: 15, scale: 2 }).default("0"),
    whtRate: numeric("wht_rate", { precision: 5, scale: 2 }), // e.g., 10%, 15%

    // Bank account used (for reconciliation)
    bankAccountId: uuid("bank_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    bankTransactionId: uuid("bank_transaction_id").references(
      () => bankTransactions.id,
      { onDelete: "set null" }
    ),

    // Journal entry link (auto-created when payment is completed)
    journalEntryId: uuid("journal_entry_id").references(
      () => journalEntries.id,
      { onDelete: "set null" }
    ),

    // Status
    status: paymentStatusEnum("status").default("pending").notNull(),

    // Additional info
    description: text("description"),
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("payments_user_id_idx").on(table.userId),
    index("payments_customer_id_idx").on(table.customerId),
    index("payments_vendor_id_idx").on(table.vendorId),
    index("payments_status_idx").on(table.status),
    index("payments_payment_date_idx").on(table.paymentDate),
    index("payments_payment_type_idx").on(table.paymentType),
    index("payments_journal_entry_idx").on(table.journalEntryId),
    // Composite indexes
    index("payments_user_type_date_idx").on(
      table.userId,
      table.paymentType,
      table.paymentDate
    ),
    unique("payments_user_number_unique").on(table.userId, table.paymentNumber),
  ]
);

/**
 * Payment Allocations Table
 *
 * Links payments to specific invoices/bills.
 * Supports partial payments and overpayments.
 *
 * Example: Payment of RM 1,500 against:
 *   - Invoice INV-001 (RM 1,000) → allocate RM 1,000
 *   - Invoice INV-002 (RM 800) → allocate RM 500
 */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .references(() => payments.id, { onDelete: "cascade" })
      .notNull(),

    // Document being paid (one of these)
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    billId: uuid("bill_id").references(() => bills.id, {
      onDelete: "set null",
    }),
    creditNoteId: uuid("credit_note_id").references(() => creditNotes.id, {
      onDelete: "set null",
    }),
    debitNoteId: uuid("debit_note_id").references(() => debitNotes.id, {
      onDelete: "set null",
    }),

    // Amount allocated to this document
    allocatedAmount: numeric("allocated_amount", {
      precision: 15,
      scale: 2,
    }).notNull(),

    // WHT allocated to this document (if applicable)
    whtAllocated: numeric("wht_allocated", { precision: 15, scale: 2 }).default(
      "0"
    ),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("payment_allocations_payment_id_idx").on(table.paymentId),
    index("payment_allocations_invoice_id_idx").on(table.invoiceId),
    index("payment_allocations_bill_id_idx").on(table.billId),
    index("payment_allocations_credit_note_id_idx").on(table.creditNoteId),
    index("payment_allocations_debit_note_id_idx").on(table.debitNoteId),
  ]
);

// Relations
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
  vendor: one(vendors, {
    fields: [payments.vendorId],
    references: [vendors.id],
  }),
  bankAccount: one(accounts, {
    fields: [payments.bankAccountId],
    references: [accounts.id],
  }),
  bankTransaction: one(bankTransactions, {
    fields: [payments.bankTransactionId],
    references: [bankTransactions.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [payments.journalEntryId],
    references: [journalEntries.id],
  }),
  allocations: many(paymentAllocations),
}));

export const paymentAllocationsRelations = relations(
  paymentAllocations,
  ({ one }) => ({
    payment: one(payments, {
      fields: [paymentAllocations.paymentId],
      references: [payments.id],
    }),
    invoice: one(invoices, {
      fields: [paymentAllocations.invoiceId],
      references: [invoices.id],
    }),
    bill: one(bills, {
      fields: [paymentAllocations.billId],
      references: [bills.id],
    }),
    creditNote: one(creditNotes, {
      fields: [paymentAllocations.creditNoteId],
      references: [creditNotes.id],
    }),
    debitNote: one(debitNotes, {
      fields: [paymentAllocations.debitNoteId],
      references: [debitNotes.id],
    }),
  })
);

// TypeScript types
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert;
export type PaymentType = (typeof paymentTypeEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
