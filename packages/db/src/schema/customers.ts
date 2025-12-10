import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Customers table
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    metadata: jsonb("metadata").$type<Record<string, string>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("customers_user_id_idx").on(table.userId),
    index("customers_email_idx").on(table.email),
    // Composite indexes for common query patterns
    index("customers_user_deleted_idx").on(table.userId, table.deletedAt),
    index("customers_user_name_idx").on(table.userId, table.name),
  ]
);

// Customer metadata for additional key-value pairs
export const customerMetadata = pgTable("customer_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .references(() => customers.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
});

// Relations
export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  metadata: many(customerMetadata),
}));

export const customerMetadataRelations = relations(customerMetadata, ({ one }) => ({
  customer: one(customers, {
    fields: [customerMetadata.customerId],
    references: [customers.id],
  }),
}));
