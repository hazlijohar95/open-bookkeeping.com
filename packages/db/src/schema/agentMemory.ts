import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  varchar,
  numeric,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================
// LONG-TERM MEMORY SYSTEM
// ============================================

/**
 * Agent long-term memory for storing learned preferences, patterns, and context
 * This enables the agent to remember important information across sessions
 */
export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Memory categorization
    category: varchar("category", { length: 50 }).notNull(),
    // Categories: 'preference', 'fact', 'pattern', 'instruction', 'context', 'insight'

    // Memory content
    key: varchar("key", { length: 255 }).notNull(), // e.g., "default_currency", "invoice_prefix"
    value: text("value").notNull(), // The actual memory content

    // Rich metadata for semantic search
    embedding: jsonb("embedding").$type<number[]>(), // For future vector search
    tags: jsonb("tags").$type<string[]>(), // For filtering

    // Source tracking - where did this memory come from?
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    // Types: 'user_explicit', 'inferred', 'system', 'conversation'
    sourceSessionId: uuid("source_session_id"),
    sourceMessageId: uuid("source_message_id"),

    // Confidence and relevance scoring
    confidence: numeric("confidence", { precision: 3, scale: 2 }).default("1.00"),
    useCount: numeric("use_count", { precision: 10, scale: 0 }).default("0"),
    lastUsedAt: timestamp("last_used_at"),

    // Memory lifecycle
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at"), // For temporary memories

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_memories_user_id_idx").on(table.userId),
    index("agent_memories_category_idx").on(table.userId, table.category),
    index("agent_memories_key_idx").on(table.userId, table.key),
    index("agent_memories_active_idx").on(table.userId, table.isActive),
  ]
);

/**
 * User-specific agent preferences and settings
 * Quick access to common configuration without searching memories
 */
export const agentUserContext = pgTable(
  "agent_user_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    // Business context
    companyName: varchar("company_name", { length: 255 }),
    companyAddress: text("company_address"),
    defaultCurrency: varchar("default_currency", { length: 3 }).default("MYR"),
    fiscalYearEnd: varchar("fiscal_year_end", { length: 10 }), // MM-DD format
    industry: varchar("industry", { length: 100 }),

    // Preferences
    preferredLanguage: varchar("preferred_language", { length: 10 }).default("en"),
    dateFormat: varchar("date_format", { length: 20 }).default("YYYY-MM-DD"),
    invoicePrefix: varchar("invoice_prefix", { length: 20 }),
    quotationPrefix: varchar("quotation_prefix", { length: 20 }),

    // Agent behavior preferences
    verbosityLevel: varchar("verbosity_level", { length: 20 }).default("normal"),
    // Levels: 'concise', 'normal', 'detailed'
    autoSuggestActions: boolean("auto_suggest_actions").default(true),
    confirmBeforeActions: boolean("confirm_before_actions").default(true),

    // Learned patterns (updated over time)
    commonTasks: jsonb("common_tasks").$type<string[]>(),
    frequentCustomers: jsonb("frequent_customers").$type<string[]>(),
    frequentVendors: jsonb("frequent_vendors").$type<string[]>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_user_context_user_id_idx").on(table.userId),
  ]
);

// Relations
export const agentMemoriesRelations = relations(agentMemories, ({ one }) => ({
  user: one(users, {
    fields: [agentMemories.userId],
    references: [users.id],
  }),
}));

export const agentUserContextRelations = relations(agentUserContext, ({ one }) => ({
  user: one(users, {
    fields: [agentUserContext.userId],
    references: [users.id],
  }),
}));
