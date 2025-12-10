import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { agentSessions } from "./agentSessions";
import {
  agentWorkflowStatusEnum,
  agentWorkflowStepStatusEnum,
  agentActionTypeEnum,
} from "./enums";

// Multi-step workflow orchestration
export const agentWorkflows = pgTable(
  "agent_workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id").references(() => agentSessions.id, {
      onDelete: "set null",
    }),

    // Workflow definition
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    templateId: varchar("template_id", { length: 100 }), // Pre-built template identifier

    // Steps tracking
    totalSteps: integer("total_steps").notNull(),
    completedSteps: integer("completed_steps").default(0).notNull(),
    currentStep: integer("current_step").default(0).notNull(),

    // State
    status: agentWorkflowStatusEnum("status").default("pending").notNull(),

    // Execution plan (array of planned steps)
    plan: jsonb("plan").$type<
      Array<{
        stepNumber: number;
        action: string;
        description: string;
        parameters: Record<string, unknown>;
        dependsOn?: number[]; // Step numbers this depends on
        requiresApproval?: boolean;
      }>
    >(),

    // Execution log (what actually happened)
    executionLog: jsonb("execution_log").$type<
      Array<{
        stepNumber: number;
        startedAt: string;
        completedAt?: string;
        status: string;
        result?: unknown;
        error?: string;
      }>
    >(),

    // Error handling
    lastError: text("last_error"),
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetries: integer("max_retries").default(3).notNull(),

    // Context data passed between steps
    workflowContext: jsonb("workflow_context").$type<Record<string, unknown>>(),

    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    pausedAt: timestamp("paused_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_workflows_user_idx").on(table.userId),
    index("agent_workflows_session_idx").on(table.sessionId),
    index("agent_workflows_status_idx").on(table.status),
    index("agent_workflows_user_status_idx").on(table.userId, table.status),
    index("agent_workflows_template_idx").on(table.templateId),
  ]
);

// Individual steps within a workflow
export const agentWorkflowSteps = pgTable(
  "agent_workflow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => agentWorkflows.id, { onDelete: "cascade" })
      .notNull(),

    stepNumber: integer("step_number").notNull(),
    action: agentActionTypeEnum("action").notNull(),
    description: text("description"),
    parameters: jsonb("parameters").$type<Record<string, unknown>>(),

    // Dependencies (other step IDs this depends on)
    dependsOn: jsonb("depends_on").$type<string[]>(),

    // Execution
    status: agentWorkflowStepStatusEnum("status").default("pending").notNull(),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),

    // Approval
    requiresApproval: varchar("requires_approval", { length: 10 }).default(
      "no"
    ), // yes, no
    approvalId: uuid("approval_id"), // Reference to pending_approvals if waiting

    // Audit trail
    auditLogId: uuid("audit_log_id"), // Reference to agent_audit_logs after execution

    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_workflow_steps_workflow_idx").on(table.workflowId),
    index("agent_workflow_steps_status_idx").on(table.status),
    index("agent_workflow_steps_workflow_step_idx").on(
      table.workflowId,
      table.stepNumber
    ),
  ]
);

// Pre-built workflow templates
export const agentWorkflowTemplates = pgTable("agent_workflow_templates", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }), // month_end, invoicing, reconciliation, etc.

  // Template definition
  steps: jsonb("steps")
    .$type<
      Array<{
        stepNumber: number;
        action: string;
        description: string;
        parameterSchema: Record<string, unknown>; // JSON Schema for parameters
        dependsOn?: number[];
        requiresApproval?: boolean;
      }>
    >()
    .notNull(),

  // Metadata
  estimatedDuration: varchar("estimated_duration", { length: 50 }), // e.g., "5-10 minutes"
  isEnabled: varchar("is_enabled", { length: 10 }).default("yes"), // yes, no

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const agentWorkflowsRelations = relations(
  agentWorkflows,
  ({ one, many }) => ({
    user: one(users, {
      fields: [agentWorkflows.userId],
      references: [users.id],
    }),
    session: one(agentSessions, {
      fields: [agentWorkflows.sessionId],
      references: [agentSessions.id],
    }),
    steps: many(agentWorkflowSteps),
  })
);

export const agentWorkflowStepsRelations = relations(
  agentWorkflowSteps,
  ({ one }) => ({
    workflow: one(agentWorkflows, {
      fields: [agentWorkflowSteps.workflowId],
      references: [agentWorkflows.id],
    }),
  })
);
