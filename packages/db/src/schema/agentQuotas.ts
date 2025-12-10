import {
  pgTable,
  uuid,
  timestamp,
  integer,
  numeric,
  date,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Quota/limit settings per user for AI agent safety
export const agentQuotas = pgTable("agent_quotas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),

  // Daily action limits
  dailyInvoiceLimit: integer("daily_invoice_limit").default(100).notNull(),
  dailyBillLimit: integer("daily_bill_limit").default(100).notNull(),
  dailyJournalEntryLimit: integer("daily_journal_entry_limit")
    .default(200)
    .notNull(),
  dailyQuotationLimit: integer("daily_quotation_limit").default(100).notNull(),

  // Token limits (for cost control)
  dailyTokenLimit: integer("daily_token_limit").default(1000000).notNull(),

  // Amount limits (prevent catastrophic errors)
  maxSingleInvoiceAmount: numeric("max_single_invoice_amount", {
    precision: 15,
    scale: 2,
  }),
  maxSingleBillAmount: numeric("max_single_bill_amount", {
    precision: 15,
    scale: 2,
  }),
  maxSingleJournalAmount: numeric("max_single_journal_amount", {
    precision: 15,
    scale: 2,
  }),
  maxDailyTotalAmount: numeric("max_daily_total_amount", {
    precision: 15,
    scale: 2,
  }),

  // Rate limiting
  maxActionsPerMinute: integer("max_actions_per_minute").default(30).notNull(),
  maxConcurrentWorkflows: integer("max_concurrent_workflows").default(5).notNull(),

  // Emergency stop flag
  emergencyStopEnabled: boolean("emergency_stop_enabled")
    .default(false)
    .notNull(),
  emergencyStopReason: timestamp("emergency_stop_reason"),
  emergencyStoppedAt: timestamp("emergency_stopped_at"),
  emergencyStoppedBy: uuid("emergency_stopped_by").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Daily usage tracking
export const agentUsage = pgTable(
  "agent_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    date: date("date").notNull(),

    // Action counts
    invoicesCreated: integer("invoices_created").default(0).notNull(),
    billsCreated: integer("bills_created").default(0).notNull(),
    journalEntriesCreated: integer("journal_entries_created")
      .default(0)
      .notNull(),
    quotationsCreated: integer("quotations_created").default(0).notNull(),

    // Total actions
    totalActions: integer("total_actions").default(0).notNull(),
    totalMutations: integer("total_mutations").default(0).notNull(),
    totalReads: integer("total_reads").default(0).notNull(),

    // Financial totals
    totalAmountProcessed: numeric("total_amount_processed", {
      precision: 15,
      scale: 2,
    }).default("0"),

    // Token usage
    tokensUsed: integer("tokens_used").default(0).notNull(),
    promptTokensUsed: integer("prompt_tokens_used").default(0).notNull(),
    completionTokensUsed: integer("completion_tokens_used").default(0).notNull(),

    // Workflow counts
    workflowsStarted: integer("workflows_started").default(0).notNull(),
    workflowsCompleted: integer("workflows_completed").default(0).notNull(),
    workflowsFailed: integer("workflows_failed").default(0).notNull(),

    // Approval counts
    approvalsRequested: integer("approvals_requested").default(0).notNull(),
    approvalsGranted: integer("approvals_granted").default(0).notNull(),
    approvalsRejected: integer("approvals_rejected").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_usage_user_date_idx").on(table.userId, table.date),
    index("agent_usage_user_idx").on(table.userId),
    index("agent_usage_date_idx").on(table.date),
  ]
);

// Relations
export const agentQuotasRelations = relations(agentQuotas, ({ one }) => ({
  user: one(users, {
    fields: [agentQuotas.userId],
    references: [users.id],
  }),
  emergencyStopper: one(users, {
    fields: [agentQuotas.emergencyStoppedBy],
    references: [users.id],
    relationName: "emergencyStopper",
  }),
}));

export const agentUsageRelations = relations(agentUsage, ({ one }) => ({
  user: one(users, {
    fields: [agentUsage.userId],
    references: [users.id],
  }),
}));
