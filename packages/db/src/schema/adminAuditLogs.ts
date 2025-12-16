import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { adminActionTypeEnum } from "./enums";

// ============================================
// ADMIN AUDIT LOGS
// ============================================

/**
 * Tracks all actions performed by superadmins.
 * Provides full audit trail for security and compliance.
 */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Who performed the action
    adminId: uuid("admin_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),

    // What action was performed
    action: adminActionTypeEnum("action").notNull(),
    description: text("description"), // Human-readable description

    // Target of the action
    targetType: varchar("target_type", { length: 50 }), // 'user', 'organization', 'system'
    targetId: uuid("target_id"), // ID of the affected entity
    targetEmail: text("target_email"), // For user actions, store email for easier lookup

    // State tracking
    previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
    newState: jsonb("new_state").$type<Record<string, unknown>>(),

    // Request context
    ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 36 }), // Correlation ID

    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("admin_audit_logs_admin_idx").on(table.adminId),
    index("admin_audit_logs_action_idx").on(table.action),
    index("admin_audit_logs_target_idx").on(table.targetType, table.targetId),
    index("admin_audit_logs_created_idx").on(table.createdAt),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(users, {
    fields: [adminAuditLogs.adminId],
    references: [users.id],
  }),
}));

// ============================================
// TYPES
// ============================================

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert;
