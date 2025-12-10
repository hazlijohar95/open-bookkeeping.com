import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// API permissions type
export type ApiKeyPermission =
  | "invoices:read"
  | "invoices:write"
  | "customers:read"
  | "customers:write"
  | "vendors:read"
  | "vendors:write"
  | "quotations:read"
  | "quotations:write"
  | "bills:read"
  | "bills:write"
  | "credit-notes:read"
  | "credit-notes:write"
  | "debit-notes:read"
  | "debit-notes:write"
  | "accounts:read"
  | "accounts:write"
  | "journal-entries:read"
  | "journal-entries:write"
  | "reports:read"
  | "webhooks:read"
  | "webhooks:write"
  | "vault:read"
  | "vault:write"
  | "einvoice:read"
  | "einvoice:write";

// API Keys table - stores hashed API keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // User-friendly name like "Production Key"
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(), // SHA-256 hash of the key
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(), // First 12 chars for display: "ob_live_xxxx"
    permissions: jsonb("permissions").$type<ApiKeyPermission[]>().default([]),
    rateLimit: integer("rate_limit").default(1000), // Requests per hour
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedReason: text("revoked_reason"),
  },
  (table) => [
    index("api_keys_user_id_idx").on(table.userId),
    index("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_is_active_idx").on(table.isActive),
  ]
);

// API Key Usage table - logs API requests for analytics
export const apiKeyUsage = pgTable(
  "api_key_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    endpoint: varchar("endpoint", { length: 200 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    ipAddress: varchar("ip_address", { length: 45 }), // IPv6 max length
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("api_key_usage_api_key_id_idx").on(table.apiKeyId),
    index("api_key_usage_created_at_idx").on(table.createdAt),
    // Composite index for time-range queries per API key
    index("api_key_usage_key_created_idx").on(table.apiKeyId, table.createdAt),
  ]
);

// Relations
export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  usage: many(apiKeyUsage),
}));

export const apiKeyUsageRelations = relations(apiKeyUsage, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyUsage.apiKeyId],
    references: [apiKeys.id],
  }),
}));

// Type exports for use in services
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsageRecord = typeof apiKeyUsage.$inferSelect;
export type NewApiKeyUsageRecord = typeof apiKeyUsage.$inferInsert;
