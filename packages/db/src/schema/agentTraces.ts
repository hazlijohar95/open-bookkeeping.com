import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  varchar,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { agentSessions } from "./agentSessions";

/**
 * Agent Traces Table
 * Stores distributed tracing data for AI agent operations.
 * Each trace represents a full conversation turn with spans for individual operations.
 */
export const agentTraces = pgTable(
  "agent_traces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),

    // Session context (optional)
    sessionId: uuid("session_id").references(() => agentSessions.id, {
      onDelete: "set null",
    }),

    // Trace identification
    name: varchar("name", { length: 255 }).notNull(),

    // Timing
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time"),
    durationMs: integer("duration_ms"),

    // Status
    status: varchar("status", { length: 20 }).notNull().default("unset"), // ok, error, unset

    // Spans (nested operations within the trace)
    spans: jsonb("spans")
      .$type<
        Array<{
          traceId: string;
          spanId: string;
          parentSpanId?: string;
          name: string;
          kind: "llm" | "tool" | "retrieval" | "chain" | "agent" | "embedding";
          status: "ok" | "error" | "unset";
          startTime: string;
          endTime?: string;
          durationMs?: number;
          attributes: Record<string, unknown>;
          events: Array<{
            name: string;
            timestamp: string;
            attributes?: Record<string, unknown>;
          }>;
        }>
      >()
      .default([]),

    // Trace metadata (aggregated from spans)
    metadata: jsonb("metadata").$type<{
      userMessage?: string;
      assistantResponse?: string;
      totalTokens?: number;
      totalCost?: number;
      toolsUsed?: string[];
      errorCount?: number;
    }>(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_traces_user_id_idx").on(table.userId),
    index("agent_traces_session_idx").on(table.sessionId),
    index("agent_traces_status_idx").on(table.status),
    index("agent_traces_start_time_idx").on(table.startTime),
    index("agent_traces_user_start_idx").on(table.userId, table.startTime),
  ]
);

// Relations
export const agentTracesRelations = relations(agentTraces, ({ one }) => ({
  user: one(users, {
    fields: [agentTraces.userId],
    references: [users.id],
  }),
  session: one(agentSessions, {
    fields: [agentTraces.sessionId],
    references: [agentSessions.id],
  }),
}));
