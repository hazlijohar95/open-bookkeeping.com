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
import { agentSessionStatusEnum } from "./enums";

// Agent conversation sessions for memory/context persistence
export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Session metadata
    title: varchar("title", { length: 255 }),
    status: agentSessionStatusEnum("status").default("active").notNull(),

    // Context
    initialPrompt: text("initial_prompt"),
    systemContext: jsonb("system_context").$type<{
      companyName?: string;
      currency?: string;
      fiscalYearEnd?: string;
      preferences?: Record<string, unknown>;
    }>(),

    // Summary for long conversations
    summary: text("summary"),

    // Token tracking for billing/limits
    totalPromptTokens: integer("total_prompt_tokens").default(0).notNull(),
    totalCompletionTokens: integer("total_completion_tokens").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("agent_sessions_user_id_idx").on(table.userId),
    index("agent_sessions_status_idx").on(table.status),
    index("agent_sessions_user_created_idx").on(table.userId, table.createdAt),
    // Composite index for common query: user's active sessions by date
    index("agent_sessions_user_status_created_idx").on(table.userId, table.status, table.createdAt),
  ]
);

// Individual messages within a session
export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => agentSessions.id, { onDelete: "cascade" })
      .notNull(),

    // Message role: user, assistant, system, tool
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content"),

    // Tool call tracking
    toolCalls: jsonb("tool_calls").$type<
      Array<{
        id: string;
        name: string;
        arguments: Record<string, unknown>;
      }>
    >(),
    toolResults: jsonb("tool_results").$type<
      Array<{
        toolCallId: string;
        result: unknown;
        error?: string;
      }>
    >(),

    // Token tracking per message
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),

    // For referencing actions taken
    actionId: uuid("action_id"), // Reference to agent_audit_logs if action was taken

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_messages_session_id_idx").on(table.sessionId),
    index("agent_messages_session_created_idx").on(
      table.sessionId,
      table.createdAt
    ),
  ]
);

// Relations
export const agentSessionsRelations = relations(
  agentSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [agentSessions.userId],
      references: [users.id],
    }),
    messages: many(agentMessages),
  })
);

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  session: one(agentSessions, {
    fields: [agentMessages.sessionId],
    references: [agentSessions.id],
  }),
}));
