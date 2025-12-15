import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { userActionTypeEnum } from "./enums";

/**
 * User Audit Logs Schema
 * Tracks important user actions for security and compliance
 * Separate from agent audit logs which track AI agent actions
 */
export const userAuditLogs = pgTable(
  "user_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Action details
    action: userActionTypeEnum("action").notNull(),
    category: varchar("category", { length: 50 }).notNull(), // auth, settings, export, api_key, webhook, security
    description: text("description"), // Human-readable description of what happened

    // Resource context (optional - for resource-specific actions)
    resourceType: varchar("resource_type", { length: 50 }), // settings, api_key, webhook, etc.
    resourceId: varchar("resource_id", { length: 100 }), // ID of affected resource

    // Before/After state for audit trail (settings changes, etc.)
    previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
    newState: jsonb("new_state").$type<Record<string, unknown>>(),

    // Request metadata for security/debugging
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 100 }), // For correlation with logs

    // Geographic context (from IP geolocation if available)
    geoLocation: jsonb("geo_location").$type<{
      country?: string;
      region?: string;
      city?: string;
      timezone?: string;
    }>(),

    // Device/Session context
    sessionId: varchar("session_id", { length: 100 }),
    deviceInfo: jsonb("device_info").$type<{
      browser?: string;
      os?: string;
      device?: string;
      isMobile?: boolean;
    }>(),

    // Success/Failure tracking
    success: varchar("success", { length: 10 }).default("yes").notNull(), // yes, no
    errorMessage: text("error_message"),
    errorCode: varchar("error_code", { length: 50 }),

    // Risk assessment (for security monitoring)
    riskLevel: varchar("risk_level", { length: 20 }).default("low"), // low, medium, high, critical
    riskFactors: jsonb("risk_factors").$type<string[]>(), // List of risk indicators

    // Additional context
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_audit_user_id_idx").on(table.userId),
    index("user_audit_action_idx").on(table.action),
    index("user_audit_category_idx").on(table.category),
    index("user_audit_created_idx").on(table.createdAt),
    index("user_audit_user_created_idx").on(table.userId, table.createdAt),
    index("user_audit_user_action_idx").on(table.userId, table.action),
    index("user_audit_user_category_idx").on(table.userId, table.category),
    index("user_audit_ip_idx").on(table.ipAddress),
    index("user_audit_risk_idx").on(table.riskLevel),
    index("user_audit_session_idx").on(table.sessionId),
  ]
);

// Relations
export const userAuditLogsRelations = relations(userAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [userAuditLogs.userId],
    references: [users.id],
  }),
}));

// Type exports for service usage
export type UserAuditLog = typeof userAuditLogs.$inferSelect;
export type NewUserAuditLog = typeof userAuditLogs.$inferInsert;
export type UserActionType = (typeof userActionTypeEnum.enumValues)[number];
