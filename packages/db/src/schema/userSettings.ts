import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// User settings table - stores preferences and defaults for each user
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),

  // Company Profile
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyLogo: text("company_logo"),
  companyTaxId: text("company_tax_id"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyWebsite: text("company_website"),

  // Invoice Defaults
  defaultCurrency: text("default_currency").default("MYR"),
  defaultPaymentTerms: text("default_payment_terms"),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }),
  invoicePrefix: text("invoice_prefix").default("INV"),
  quotationPrefix: text("quotation_prefix").default("QT"),
  invoiceNotes: text("invoice_notes"),
  invoiceTerms: text("invoice_terms"),

  // Notifications
  emailOnOverdue: boolean("email_on_overdue").default(true),
  emailOnPayment: boolean("email_on_payment").default(true),
  emailOnQuotationAccepted: boolean("email_on_quotation_accepted").default(true),
  overdueReminderDays: integer("overdue_reminder_days").default(7),

  // Display Preferences
  theme: text("theme").default("system"), // light, dark, system
  dateFormat: text("date_format").default("DD/MM/YYYY"),
  numberFormat: text("number_format").default("1,234.56"),

  // SST Compliance Settings
  sstBusinessCategory: varchar("sst_business_category", { length: 50 }), // fnb, telecom, parking, other_services, manufacturing
  sstRegistrationNumber: varchar("sst_registration_number", { length: 50 }),
  sstRegistrationDate: timestamp("sst_registration_date"),
  sstManualRevenue: numeric("sst_manual_revenue", { precision: 15, scale: 2 }), // Manual override for annual revenue
  sstUseManualRevenue: boolean("sst_use_manual_revenue").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

// Export types
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
