import { pgTable, uuid, text, timestamp, jsonb, index, integer, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Vendors table
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Basic Information (required: name only)
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    website: text("website"),

    // Bank Details (all optional)
    bankName: text("bank_name"),
    bankAccountNumber: text("bank_account_number"),
    bankRoutingNumber: text("bank_routing_number"),
    bankSwiftCode: text("bank_swift_code"),

    // Tax Identifiers (all optional)
    taxId: text("tax_id"),
    vatNumber: text("vat_number"),
    registrationNumber: text("registration_number"),

    // Payment Terms (all optional)
    paymentTermsDays: integer("payment_terms_days"),
    preferredPaymentMethod: text("preferred_payment_method"),
    creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),

    // Flexible metadata for custom fields
    metadata: jsonb("metadata").$type<Record<string, string>>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("vendors_user_id_idx").on(table.userId),
    index("vendors_email_idx").on(table.email),
    index("vendors_name_idx").on(table.name),
    // Composite indexes for common query patterns
    index("vendors_user_deleted_idx").on(table.userId, table.deletedAt),
    index("vendors_user_name_idx").on(table.userId, table.name),
  ]
);

// Vendor metadata for additional key-value pairs
export const vendorMetadata = pgTable("vendor_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .references(() => vendors.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
});

// Relations
export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  user: one(users, {
    fields: [vendors.userId],
    references: [users.id],
  }),
  metadata: many(vendorMetadata),
}));

export const vendorMetadataRelations = relations(vendorMetadata, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorMetadata.vendorId],
    references: [vendors.id],
  }),
}));

// TypeScript types
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type VendorMetadata = typeof vendorMetadata.$inferSelect;
export type NewVendorMetadata = typeof vendorMetadata.$inferInsert;
