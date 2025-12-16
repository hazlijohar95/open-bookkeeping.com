import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userRoleEnum } from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supabaseId: text("supabase_id").unique().notNull(), // Links to Supabase auth.users
    email: text("email").unique().notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),

    // Platform-wide role (superadmin has access to admin dashboard)
    role: userRoleEnum("role").default("user").notNull(),

    // Suspension status
    isSuspended: boolean("is_suspended").default(false).notNull(),
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    suspendedBy: uuid("suspended_by"), // Admin who suspended

    // Last activity tracking
    lastLoginAt: timestamp("last_login_at"),
    lastActiveAt: timestamp("last_active_at"),

    allowedSavingData: boolean("allowed_saving_data").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("users_role_idx").on(table.role),
    index("users_is_suspended_idx").on(table.isSuspended),
    index("users_last_active_idx").on(table.lastActiveAt),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  invoices: many(invoices),
  invoiceMonthlyTotals: many(invoiceMonthlyTotals),
  sstMonthlyTotals: many(sstMonthlyTotals),
  organizationMemberships: many(organizationMembers),
}));

// Import after to avoid circular dependency
import { invoices } from "./invoices";
import { invoiceMonthlyTotals, sstMonthlyTotals } from "./aggregations";
import { organizationMembers } from "./organizations";

// Export type for User
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
