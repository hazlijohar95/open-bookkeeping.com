import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { vendors } from "./vendors";
import { billStatusEnum } from "./enums";

// Re-export enum for backward compatibility
export { billStatusEnum };

// Bills table - invoices received FROM vendors (Accounts Payable - what we owe them)
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    vendorId: uuid("vendor_id").references(() => vendors.id, {
      onDelete: "set null",
    }),

    // Bill details
    billNumber: text("bill_number").notNull(),
    description: text("description"),
    currency: text("currency").default("MYR").notNull(),

    // Dates
    billDate: timestamp("bill_date").notNull(),
    dueDate: timestamp("due_date"),
    paidAt: timestamp("paid_at"),

    // Status: draft, pending, paid, overdue, cancelled
    status: billStatusEnum("status").default("pending").notNull(),

    // Financial totals (extracted from documents)
    subtotal: numeric("subtotal", { precision: 15, scale: 2 }),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }),
    total: numeric("total", { precision: 15, scale: 2 }),
    paymentTerms: text("payment_terms"),

    // Additional info
    notes: text("notes"),
    attachmentUrl: text("attachment_url"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("bills_user_id_idx").on(table.userId),
    index("bills_vendor_id_idx").on(table.vendorId),
    index("bills_status_idx").on(table.status),
    index("bills_due_date_idx").on(table.dueDate),
    // Composite indexes for common query patterns
    index("bills_user_status_idx").on(table.userId, table.status),
    index("bills_user_created_idx").on(table.userId, table.createdAt),
    index("bills_user_deleted_idx").on(table.userId, table.deletedAt),
    index("bills_user_due_date_idx").on(table.userId, table.dueDate),
  ]
);

// Bill line items
export const billItems = pgTable(
  "bill_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .references(() => bills.id, { onDelete: "cascade" })
      .notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 })
      .default("1")
      .notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }), // Calculated: quantity * unitPrice
  },
  (table) => [index("bill_items_bill_id_idx").on(table.billId)]
);

// Relations
export const billsRelations = relations(bills, ({ one, many }) => ({
  user: one(users, {
    fields: [bills.userId],
    references: [users.id],
  }),
  vendor: one(vendors, {
    fields: [bills.vendorId],
    references: [vendors.id],
  }),
  items: many(billItems),
}));

export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(bills, {
    fields: [billItems.billId],
    references: [bills.id],
  }),
}));

// TypeScript types
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillItem = typeof billItems.$inferSelect;
export type NewBillItem = typeof billItems.$inferInsert;
export type BillStatus = (typeof billStatusEnum.enumValues)[number];
