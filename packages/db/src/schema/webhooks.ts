import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Webhook event types
export type WebhookEvent =
  // Invoice events
  | "invoice.created"
  | "invoice.updated"
  | "invoice.deleted"
  | "invoice.paid"
  | "invoice.overdue"
  | "invoice.sent"
  // Payment events
  | "payment.received"
  | "payment.refunded"
  // Customer events
  | "customer.created"
  | "customer.updated"
  | "customer.deleted"
  // Vendor events
  | "vendor.created"
  | "vendor.updated"
  | "vendor.deleted"
  // Quotation events
  | "quotation.created"
  | "quotation.updated"
  | "quotation.accepted"
  | "quotation.rejected"
  | "quotation.converted"
  // Bill events
  | "bill.created"
  | "bill.updated"
  | "bill.paid"
  // Credit/Debit note events
  | "credit-note.created"
  | "credit-note.applied"
  | "debit-note.created"
  | "debit-note.applied"
  // E-Invoice events (Malaysia MyInvois)
  | "einvoice.submitted"
  | "einvoice.validated"
  | "einvoice.rejected"
  | "einvoice.cancelled";

// Webhooks table - stores webhook endpoint configurations
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(), // Webhook endpoint URL
    secret: varchar("secret", { length: 64 }).notNull(), // For HMAC signature verification
    description: text("description"), // User-friendly description
    events: jsonb("events").$type<WebhookEvent[]>().notNull(), // Events to subscribe to
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhooks_user_id_idx").on(table.userId),
    index("webhooks_is_active_idx").on(table.isActive),
    // Composite index for finding active webhooks per user
    index("webhooks_user_active_idx").on(table.userId, table.isActive),
  ]
);

// Webhook delivery status
export type WebhookDeliveryStatus = "pending" | "success" | "failed" | "retrying";

// Webhook Deliveries table - logs webhook delivery attempts
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 50 }).notNull(), // The event type that triggered this
    eventId: varchar("event_id", { length: 50 }).notNull(), // Unique event ID for idempotency
    payload: jsonb("payload").notNull(), // The webhook payload sent
    status: varchar("status", { length: 20 })
      .$type<WebhookDeliveryStatus>()
      .default("pending")
      .notNull(),
    statusCode: integer("status_code"), // HTTP response code
    responseBody: text("response_body"), // Response from webhook endpoint
    responseTimeMs: integer("response_time_ms"),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    nextRetryAt: timestamp("next_retry_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_deliveries_webhook_id_idx").on(table.webhookId),
    index("webhook_deliveries_status_idx").on(table.status),
    index("webhook_deliveries_next_retry_idx").on(table.nextRetryAt),
    index("webhook_deliveries_event_id_idx").on(table.eventId),
    index("webhook_deliveries_created_at_idx").on(table.createdAt),
    // Composite index for finding pending retries
    index("webhook_deliveries_status_retry_idx").on(table.status, table.nextRetryAt),
  ]
);

// Relations
export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user: one(users, {
    fields: [webhooks.userId],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

// Type exports for use in services
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
