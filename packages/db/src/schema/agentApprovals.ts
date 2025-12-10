import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { agentSessions } from "./agentSessions";
import { agentApprovalStatusEnum, agentActionTypeEnum } from "./enums";

// Approval settings per user (configurable human-in-loop)
export const agentApprovalSettings = pgTable("agent_approval_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),

  // Global toggle for requiring approval
  requireApproval: boolean("require_approval").default(false).notNull(),

  // Amount thresholds (require approval above these amounts)
  invoiceThreshold: numeric("invoice_threshold", { precision: 15, scale: 2 }),
  billThreshold: numeric("bill_threshold", { precision: 15, scale: 2 }),
  journalEntryThreshold: numeric("journal_entry_threshold", {
    precision: 15,
    scale: 2,
  }),

  // Action-specific settings
  autoApproveReadOnly: boolean("auto_approve_read_only").default(true).notNull(),
  autoApproveRecurring: boolean("auto_approve_recurring").default(false).notNull(),

  // Whitelist/blacklist specific actions
  allowedActions: jsonb("allowed_actions").$type<string[]>(), // Empty = all allowed
  blockedActions: jsonb("blocked_actions").$type<string[]>(), // Actions that always require approval

  // Notification preferences
  notifyOnApprovalRequired: boolean("notify_on_approval_required")
    .default(true)
    .notNull(),
  notifyOnAutoApproved: boolean("notify_on_auto_approved")
    .default(false)
    .notNull(),

  // Approval timeout (in hours) - after which pending approvals expire
  approvalTimeoutHours: numeric("approval_timeout_hours").default("24"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pending approval queue
export const agentPendingApprovals = pgTable(
  "agent_pending_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // What action is pending
    actionType: agentActionTypeEnum("action_type").notNull(),
    actionPayload: jsonb("action_payload")
      .$type<Record<string, unknown>>()
      .notNull(), // Full parameters for the action

    // Context
    sessionId: uuid("session_id").references(() => agentSessions.id, {
      onDelete: "set null",
    }),
    reasoning: text("reasoning"), // AI's explanation for the action
    confidence: numeric("confidence", { precision: 3, scale: 2 }), // AI's confidence 0.00-1.00

    // Status
    status: agentApprovalStatusEnum("status").default("pending").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),

    // Estimated impact for risk assessment
    estimatedImpact: jsonb("estimated_impact").$type<{
      amount?: number;
      currency?: string;
      resourceType?: string;
      accountsAffected?: string[];
      description?: string;
    }>(),

    // Preview of what will be created/changed
    previewData: jsonb("preview_data").$type<Record<string, unknown>>(),

    // Expiration
    expiresAt: timestamp("expires_at").notNull(),

    // If approved, the resulting audit log ID
    resultAuditId: uuid("result_audit_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_pending_user_idx").on(table.userId),
    index("agent_pending_status_idx").on(table.status),
    index("agent_pending_user_status_idx").on(table.userId, table.status),
    index("agent_pending_expires_idx").on(table.expiresAt),
    index("agent_pending_session_idx").on(table.sessionId),
  ]
);

// Relations
export const agentApprovalSettingsRelations = relations(
  agentApprovalSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [agentApprovalSettings.userId],
      references: [users.id],
    }),
  })
);

export const agentPendingApprovalsRelations = relations(
  agentPendingApprovals,
  ({ one }) => ({
    user: one(users, {
      fields: [agentPendingApprovals.userId],
      references: [users.id],
    }),
    session: one(agentSessions, {
      fields: [agentPendingApprovals.sessionId],
      references: [agentSessions.id],
    }),
    reviewer: one(users, {
      fields: [agentPendingApprovals.reviewedBy],
      references: [users.id],
      relationName: "reviewer",
    }),
  })
);
