import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * Platform-wide settings controlled by superadmins.
 * Single-row table for global configuration.
 */
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Maintenance mode
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  maintenanceMessage: text("maintenance_message"),
  maintenanceStartAt: timestamp("maintenance_start_at"),
  maintenanceEndAt: timestamp("maintenance_end_at"),

  // Announcement banner
  announcementEnabled: boolean("announcement_enabled").default(false).notNull(),
  announcementMessage: text("announcement_message"),
  announcementType: varchar("announcement_type", { length: 20 }).default("info"), // info, warning, error
  announcementExpiresAt: timestamp("announcement_expires_at"),

  // Default rate limits
  defaultRateLimitPerMinute: integer("default_rate_limit_per_minute").default(60).notNull(),
  defaultRateLimitPerHour: integer("default_rate_limit_per_hour").default(1000).notNull(),

  // Default quotas for new users
  defaultDailyInvoiceLimit: integer("default_daily_invoice_limit").default(50).notNull(),
  defaultDailyBillLimit: integer("default_daily_bill_limit").default(50).notNull(),
  defaultDailyTokenLimit: integer("default_daily_token_limit").default(100000).notNull(),

  // Security settings
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(60).notNull(),
  require2FA: boolean("require_2fa").default(false).notNull(),
  allowNewSignups: boolean("allow_new_signups").default(true).notNull(),

  // Trial settings
  trialDurationDays: integer("trial_duration_days").default(7).notNull(),

  // Last updated tracking
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * Feature flags for gradual rollout and A/B testing.
 */
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Flag identification
  key: varchar("key", { length: 100 }).unique().notNull(), // e.g., 'ai_agent_v2', 'new_dashboard'
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Status
  isEnabled: boolean("is_enabled").default(false).notNull(),

  // Targeting rules (optional)
  targetRules: jsonb("target_rules").$type<{
    // Percentage rollout (0-100)
    percentage?: number;
    // Only for specific user IDs
    userIds?: string[];
    // Only for specific organization IDs
    organizationIds?: string[];
    // Only for specific plans
    plans?: string[];
    // Only for specific user roles
    roles?: string[];
  }>(),

  // Metadata
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// RELATIONS
// ============================================

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updater: one(users, {
    fields: [systemSettings.updatedBy],
    references: [users.id],
  }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  creator: one(users, {
    fields: [featureFlags.createdBy],
    references: [users.id],
  }),
  updater: one(users, {
    fields: [featureFlags.updatedBy],
    references: [users.id],
  }),
}));

// ============================================
// TYPES
// ============================================

export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;
