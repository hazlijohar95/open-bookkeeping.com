import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  supabaseId: text("supabase_id").unique().notNull(), // Links to Supabase auth.users
  email: text("email").unique().notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  allowedSavingData: boolean("allowed_saving_data").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  invoices: many(invoices),
  invoiceMonthlyTotals: many(invoiceMonthlyTotals),
  sstMonthlyTotals: many(sstMonthlyTotals),
}));

// Import after to avoid circular dependency
import { invoices } from "./invoices";
import { invoiceMonthlyTotals, sstMonthlyTotals } from "./aggregations";
