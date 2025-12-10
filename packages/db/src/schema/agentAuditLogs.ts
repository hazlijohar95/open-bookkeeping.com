import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  varchar,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { agentSessions } from "./agentSessions";
import { agentActionTypeEnum, agentApprovalTypeEnum } from "./enums";

// Comprehensive audit log for all AI agent actions
export const agentAuditLogs = pgTable(
  "agent_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Session context (optional - some actions may be automated)
    sessionId: uuid("session_id").references(() => agentSessions.id, {
      onDelete: "set null",
    }),
    workflowId: uuid("workflow_id"), // Reference to agent_workflows if part of workflow

    // Action details
    action: agentActionTypeEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(), // invoice, bill, journal_entry, customer, etc.
    resourceId: uuid("resource_id"), // ID of the affected resource

    // Before/After state for audit trail
    previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
    newState: jsonb("new_state").$type<Record<string, unknown>>(),

    // AI reasoning and confidence
    reasoning: text("reasoning"), // Why the agent took this action
    confidence: numeric("confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00

    // Human oversight tracking
    approvedBy: uuid("approved_by").references(() => users.id),
    approvalType: agentApprovalTypeEnum("approval_type"),
    approvalId: uuid("approval_id"), // Reference to pending_approvals if applicable

    // Rollback capability
    isReversible: varchar("is_reversible", { length: 10 }).default("yes"), // yes, no, partial
    reversedAt: timestamp("reversed_at"),
    reversedBy: uuid("reversed_by").references(() => users.id),
    reversalAuditId: uuid("reversal_audit_id"), // Links to the reversal action

    // Request metadata for security/debugging
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Error tracking
    success: varchar("success", { length: 10 }).default("yes").notNull(), // yes, no
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details").$type<{
      code?: string;
      stack?: string;
      context?: Record<string, unknown>;
    }>(),

    // Financial impact tracking (for limits/alerts)
    financialImpact: jsonb("financial_impact").$type<{
      amount?: number;
      currency?: string;
      direction?: "increase" | "decrease" | "neutral";
      accountsAffected?: string[];
    }>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_audit_user_id_idx").on(table.userId),
    index("agent_audit_session_idx").on(table.sessionId),
    index("agent_audit_workflow_idx").on(table.workflowId),
    index("agent_audit_resource_idx").on(table.resourceType, table.resourceId),
    index("agent_audit_action_idx").on(table.action),
    index("agent_audit_created_idx").on(table.createdAt),
    index("agent_audit_user_created_idx").on(table.userId, table.createdAt),
    index("agent_audit_user_action_idx").on(table.userId, table.action),
  ]
);

// Relations
export const agentAuditLogsRelations = relations(agentAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [agentAuditLogs.userId],
    references: [users.id],
  }),
  session: one(agentSessions, {
    fields: [agentAuditLogs.sessionId],
    references: [agentSessions.id],
  }),
  approver: one(users, {
    fields: [agentAuditLogs.approvedBy],
    references: [users.id],
    relationName: "approver",
  }),
  reverser: one(users, {
    fields: [agentAuditLogs.reversedBy],
    references: [users.id],
    relationName: "reverser",
  }),
}));
