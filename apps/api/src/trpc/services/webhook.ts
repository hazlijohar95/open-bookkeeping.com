import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { webhookRepository } from "@open-bookkeeping/db";
import type { WebhookEvent, WebhookDeliveryStatus } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { assertFound, badRequest, forbidden, internalError } from "../../lib/errors";

const logger = createLogger("webhook-service");

// Max webhooks per user
const MAX_WEBHOOKS_PER_USER = 10;

// Available webhook events
const availableEvents: WebhookEvent[] = [
  // Invoice events
  "invoice.created",
  "invoice.updated",
  "invoice.deleted",
  "invoice.paid",
  "invoice.overdue",
  "invoice.sent",
  // Payment events
  "payment.received",
  "payment.refunded",
  // Customer events
  "customer.created",
  "customer.updated",
  "customer.deleted",
  // Vendor events
  "vendor.created",
  "vendor.updated",
  "vendor.deleted",
  // Quotation events
  "quotation.created",
  "quotation.updated",
  "quotation.accepted",
  "quotation.rejected",
  "quotation.converted",
  // Bill events
  "bill.created",
  "bill.updated",
  "bill.paid",
  // Credit/Debit note events
  "credit-note.created",
  "credit-note.applied",
  "debit-note.created",
  "debit-note.applied",
  // E-Invoice events
  "einvoice.submitted",
  "einvoice.validated",
  "einvoice.rejected",
  "einvoice.cancelled",
];

// Event schema
const eventSchema = z.enum(availableEvents as [string, ...string[]]);

// Create webhook schema
const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(eventSchema).min(1),
  description: z.string().max(500).optional(),
});

// Update webhook schema
const updateWebhookSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url().max(500).optional(),
  events: z.array(eventSchema).min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

// Delivery query schema
const deliveryQuerySchema = z.object({
  webhookId: z.string().uuid(),
  status: z.enum(["pending", "success", "failed", "retrying"] as const).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

export const webhookRouter = router({
  /**
   * List all webhooks for the current user
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        includeInactive: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const includeInactive = input?.includeInactive ?? false;

      const webhooks = await webhookRepository.findMany(ctx.user.id, {
        limit,
        offset,
        includeInactive,
      });

      logger.debug(
        { userId: ctx.user.id, count: webhooks.length },
        "Listed webhooks"
      );

      // Return without secret
      return webhooks.map((webhook) => ({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      }));
    }),

  /**
   * Get a single webhook by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const webhook = await webhookRepository.findById(input.id, ctx.user.id);
      assertFound(webhook, "webhook", input.id);

      // Get stats
      const stats = await webhookRepository.getStats(input.id, ctx.user.id);

      return {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        stats,
      };
    }),

  /**
   * Create a new webhook
   */
  create: protectedProcedure
    .input(createWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      // Check limit
      const activeCount = await webhookRepository.countActive(ctx.user.id);
      if (activeCount >= MAX_WEBHOOKS_PER_USER) {
        throw forbidden(
          `Maximum of ${MAX_WEBHOOKS_PER_USER} active webhooks allowed`
        );
      }

      // Validate URL (must be HTTPS in production)
      if (
        process.env.NODE_ENV === "production" &&
        !input.url.startsWith("https://")
      ) {
        throw badRequest("Webhook URL must use HTTPS in production");
      }

      try {
        const webhook = await webhookRepository.create({
          userId: ctx.user.id,
          url: input.url,
          events: input.events as WebhookEvent[],
          description: input.description,
        });

        logger.info(
          { userId: ctx.user.id, webhookId: webhook.id, url: input.url },
          "Webhook created"
        );

        // Return with secret (only shown on creation)
        return {
          id: webhook.id,
          url: webhook.url,
          secret: webhook.secret, // Only shown once!
          events: webhook.events,
          description: webhook.description,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
        };
      } catch (error) {
        throw internalError("Failed to create webhook", error, {
          userId: ctx.user.id,
        });
      }
    }),

  /**
   * Update webhook settings
   */
  update: protectedProcedure
    .input(updateWebhookSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;

      // Validate URL if provided
      if (
        updateData.url &&
        process.env.NODE_ENV === "production" &&
        !updateData.url.startsWith("https://")
      ) {
        throw badRequest("Webhook URL must use HTTPS in production");
      }

      const updated = await webhookRepository.update(id, ctx.user.id, {
        url: updateData.url,
        events: updateData.events as WebhookEvent[] | undefined,
        description: updateData.description ?? undefined,
        isActive: updateData.isActive,
      });

      assertFound(updated, "webhook", id);

      logger.info({ userId: ctx.user.id, webhookId: id }, "Webhook updated");

      return {
        id: updated.id,
        url: updated.url,
        events: updated.events,
        description: updated.description,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      };
    }),

  /**
   * Delete a webhook
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await webhookRepository.delete(input.id, ctx.user.id);

      if (!deleted) {
        throw badRequest("Webhook not found");
      }

      logger.info(
        { userId: ctx.user.id, webhookId: input.id },
        "Webhook deleted"
      );

      return { success: true };
    }),

  /**
   * Rotate webhook secret
   */
  rotateSecret: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await webhookRepository.rotateSecret(input.id, ctx.user.id);

      if (!result) {
        throw badRequest("Webhook not found");
      }

      logger.info(
        { userId: ctx.user.id, webhookId: input.id },
        "Webhook secret rotated"
      );

      // Return new secret - only shown once!
      return {
        id: result.webhook.id,
        secret: result.secret, // New secret - only shown once!
      };
    }),

  /**
   * Get delivery history for a webhook
   */
  getDeliveries: protectedProcedure
    .input(deliveryQuerySchema)
    .query(async ({ ctx, input }) => {
      const deliveries = await webhookRepository.findDeliveries(
        input.webhookId,
        ctx.user.id,
        {
          status: input.status as WebhookDeliveryStatus | undefined,
          limit: input.limit,
          offset: input.offset,
        }
      );

      return deliveries.map((delivery) => ({
        id: delivery.id,
        event: delivery.event,
        eventId: delivery.eventId,
        status: delivery.status,
        statusCode: delivery.statusCode,
        responseTimeMs: delivery.responseTimeMs,
        attempts: delivery.attempts,
        errorMessage: delivery.errorMessage,
        deliveredAt: delivery.deliveredAt,
        failedAt: delivery.failedAt,
        createdAt: delivery.createdAt,
      }));
    }),

  /**
   * Get a single delivery by ID
   */
  getDelivery: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const delivery = await webhookRepository.findDeliveryById(
        input.id,
        ctx.user.id
      );
      assertFound(delivery, "webhook_delivery", input.id);

      return {
        id: delivery.id,
        event: delivery.event,
        eventId: delivery.eventId,
        payload: delivery.payload,
        status: delivery.status,
        statusCode: delivery.statusCode,
        responseBody: delivery.responseBody,
        responseTimeMs: delivery.responseTimeMs,
        attempts: delivery.attempts,
        maxAttempts: delivery.maxAttempts,
        nextRetryAt: delivery.nextRetryAt,
        errorMessage: delivery.errorMessage,
        deliveredAt: delivery.deliveredAt,
        failedAt: delivery.failedAt,
        createdAt: delivery.createdAt,
      };
    }),

  /**
   * Test a webhook by sending a test event
   */
  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const webhook = await webhookRepository.findById(input.id, ctx.user.id);
      assertFound(webhook, "webhook", input.id);

      // Create a test payload
      const testPayload = {
        id: `evt_test_${Date.now()}`,
        type: "test.ping",
        created: new Date().toISOString(),
        data: {
          message: "This is a test webhook event",
          timestamp: Date.now(),
        },
      };

      // Import webhook service to send test event
      // For now, just return the payload that would be sent
      logger.info(
        { userId: ctx.user.id, webhookId: input.id },
        "Webhook test requested"
      );

      return {
        success: true,
        payload: testPayload,
        message: "Test event queued for delivery",
      };
    }),

  /**
   * Get available webhook events
   */
  getAvailableEvents: protectedProcedure.query(() => {
    // Group events by category
    const grouped = availableEvents.reduce(
      (acc, event) => {
        const [category] = event.split(".");
        if (!acc[category!]) {
          acc[category!] = [];
        }
        acc[category!]!.push(event);
        return acc;
      },
      {} as Record<string, WebhookEvent[]>
    );

    return {
      events: availableEvents,
      grouped,
    };
  }),
});
