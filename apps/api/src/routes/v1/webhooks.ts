/**
 * Webhooks API v1
 * Self-service webhook management for API consumers
 */

import { Hono } from "hono";
import { z } from "zod";
import { webhookRepository } from "@open-bookkeeping/db";
import type { WebhookEvent, WebhookDeliveryStatus } from "@open-bookkeeping/db";
import { getApiKeyUserId } from "../../middleware/api-key-auth";
import {
  success,
  created,
  deleted,
  list,
  notFound,
  badRequest,
  validationError,
  internalError,
  forbidden,
  parsePagination,
  validateUuid,
} from "../../lib/api-response";
import { createLogger } from "@open-bookkeeping/shared";
import { sendTestWebhook } from "../../services/webhook.service";

const logger = createLogger("api-v1-webhooks");

// Max webhooks per user
const MAX_WEBHOOKS = 10;

// Available webhook events
const availableEvents: WebhookEvent[] = [
  "invoice.created",
  "invoice.updated",
  "invoice.deleted",
  "invoice.paid",
  "invoice.overdue",
  "invoice.sent",
  "payment.received",
  "payment.refunded",
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "vendor.created",
  "vendor.updated",
  "vendor.deleted",
  "quotation.created",
  "quotation.updated",
  "quotation.accepted",
  "quotation.rejected",
  "quotation.converted",
  "bill.created",
  "bill.updated",
  "bill.paid",
  "credit-note.created",
  "credit-note.applied",
  "debit-note.created",
  "debit-note.applied",
  "einvoice.submitted",
  "einvoice.validated",
  "einvoice.rejected",
  "einvoice.cancelled",
];

// Validation schemas
const eventSchema = z.enum(availableEvents as [string, ...string[]]);

const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(eventSchema).min(1),
  description: z.string().max(500).optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z.array(eventSchema).min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const webhooksRouter = new Hono();

/**
 * GET /api/v1/webhooks
 * List all webhooks for the authenticated user
 */
webhooksRouter.get("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    const { limit, offset } = parsePagination(c);
    const includeInactive = c.req.query("inactive") === "true";

    const webhooks = await webhookRepository.findMany(userId, {
      limit,
      offset,
      includeInactive,
    });

    // Don't expose secrets in list response
    const sanitizedWebhooks = webhooks.map((webhook) => ({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    }));

    logger.debug({ userId, count: webhooks.length }, "Listed webhooks via API");
    return list(c, sanitizedWebhooks, { limit, offset });
  } catch (error) {
    logger.error({ error }, "Failed to list webhooks");
    return internalError(c);
  }
});

/**
 * GET /api/v1/webhooks/events
 * Get list of available webhook events
 */
webhooksRouter.get("/events", async (c) => {
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

  return success(c, {
    events: availableEvents,
    grouped,
  });
});

/**
 * GET /api/v1/webhooks/:id
 * Get a single webhook by ID with stats
 */
webhooksRouter.get("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  try {
    const webhook = await webhookRepository.findById(id, userId);
    if (!webhook) {
      return notFound(c, "Webhook", id);
    }

    // Get stats
    const stats = await webhookRepository.getStats(id, userId);

    return success(c, {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      stats,
    });
  } catch (error) {
    logger.error({ error, webhookId: id }, "Failed to get webhook");
    return internalError(c);
  }
});

/**
 * POST /api/v1/webhooks
 * Create a new webhook
 */
webhooksRouter.post("/", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  try {
    // Check limit
    const activeCount = await webhookRepository.countActive(userId);
    if (activeCount >= MAX_WEBHOOKS) {
      return forbidden(c, `Maximum of ${MAX_WEBHOOKS} active webhooks allowed`);
    }

    const body = await c.req.json();
    const parseResult = createWebhookSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    // Validate HTTPS in production
    if (process.env.NODE_ENV === "production" && !input.url.startsWith("https://")) {
      return badRequest(c, "Webhook URL must use HTTPS in production");
    }

    const webhook = await webhookRepository.create({
      userId,
      url: input.url,
      events: input.events as WebhookEvent[],
      description: input.description,
    });

    logger.info({ userId, webhookId: webhook.id }, "Webhook created via API");

    // Return with secret (only shown on creation)
    return created(c, {
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret, // Only shown once!
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      message: "Store the secret securely - it will not be shown again",
    });
  } catch (error) {
    logger.error({ error }, "Failed to create webhook");
    return internalError(c);
  }
});

/**
 * PATCH /api/v1/webhooks/:id
 * Update an existing webhook
 */
webhooksRouter.patch("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  try {
    const body = await c.req.json();
    const parseResult = updateWebhookSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(c, parseResult.error.flatten());
    }

    const input = parseResult.data;

    // Validate HTTPS if URL provided
    if (input.url && process.env.NODE_ENV === "production" && !input.url.startsWith("https://")) {
      return badRequest(c, "Webhook URL must use HTTPS in production");
    }

    const webhook = await webhookRepository.update(id, userId, {
      url: input.url,
      events: input.events as WebhookEvent[] | undefined,
      description: input.description ?? undefined,
      isActive: input.isActive,
    });

    if (!webhook) {
      return notFound(c, "Webhook", id);
    }

    logger.info({ userId, webhookId: id }, "Webhook updated via API");
    return success(c, {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      updatedAt: webhook.updatedAt,
    });
  } catch (error) {
    logger.error({ error, webhookId: id }, "Failed to update webhook");
    return internalError(c);
  }
});

/**
 * DELETE /api/v1/webhooks/:id
 * Delete a webhook
 */
webhooksRouter.delete("/:id", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  try {
    const result = await webhookRepository.delete(id, userId);
    if (!result) {
      return notFound(c, "Webhook", id);
    }

    logger.info({ userId, webhookId: id }, "Webhook deleted via API");
    return deleted(c);
  } catch (error) {
    logger.error({ error, webhookId: id }, "Failed to delete webhook");
    return internalError(c);
  }
});

/**
 * POST /api/v1/webhooks/:id/rotate-secret
 * Rotate webhook signing secret
 */
webhooksRouter.post("/:id/rotate-secret", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  try {
    const result = await webhookRepository.rotateSecret(id, userId);
    if (!result) {
      return notFound(c, "Webhook", id);
    }

    logger.info({ userId, webhookId: id }, "Webhook secret rotated via API");
    return success(c, {
      id: result.webhook.id,
      secret: result.secret, // New secret - only shown once!
      message: "Store the new secret securely - it will not be shown again",
    });
  } catch (error) {
    logger.error({ error, webhookId: id }, "Failed to rotate webhook secret");
    return internalError(c);
  }
});

/**
 * GET /api/v1/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
webhooksRouter.get("/:id/deliveries", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  try {
    const { limit, offset } = parsePagination(c);
    const statusParam = c.req.query("status") as WebhookDeliveryStatus | undefined;

    const deliveries = await webhookRepository.findDeliveries(id, userId, {
      status: statusParam,
      limit,
      offset,
    });

    const sanitizedDeliveries = deliveries.map((delivery) => ({
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

    return list(c, sanitizedDeliveries, { limit, offset });
  } catch (error) {
    logger.error({ error, webhookId: id }, "Failed to get webhook deliveries");
    return internalError(c);
  }
});

/**
 * GET /api/v1/webhooks/:id/deliveries/:deliveryId
 * Get a single delivery with full payload
 */
webhooksRouter.get("/:id/deliveries/:deliveryId", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const deliveryId = c.req.param("deliveryId");

  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  const validDeliveryId = validateUuid(c, deliveryId, "delivery");
  if (validDeliveryId instanceof Response) return validDeliveryId;

  try {
    const delivery = await webhookRepository.findDeliveryById(deliveryId, userId);
    if (!delivery) {
      return notFound(c, "Webhook Delivery", deliveryId);
    }

    return success(c, {
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
    });
  } catch (error) {
    logger.error({ error, deliveryId }, "Failed to get webhook delivery");
    return internalError(c);
  }
});

/**
 * POST /api/v1/webhooks/:id/test
 * Send a test webhook to verify configuration
 */
webhooksRouter.post("/:id/test", async (c) => {
  const userId = getApiKeyUserId(c);
  if (!userId) return badRequest(c, "Invalid authentication");

  const id = c.req.param("id");
  const validId = validateUuid(c, id, "webhook");
  if (validId instanceof Response) return validId;

  try {
    const webhook = await webhookRepository.findById(id, userId);
    if (!webhook) {
      return notFound(c, "Webhook", id);
    }

    if (!webhook.isActive) {
      return badRequest(c, "Cannot test inactive webhook");
    }

    // Send test webhook
    const result = await sendTestWebhook(webhook);

    logger.info(
      { userId, webhookId: id, success: result.success, statusCode: result.statusCode },
      "Test webhook sent"
    );

    return success(c, {
      success: result.success,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
      message: result.success
        ? "Test webhook delivered successfully"
        : `Test webhook failed: ${result.error}`,
    });
  } catch (error) {
    logger.error({ error, webhookId: id }, "Failed to send test webhook");
    return internalError(c);
  }
});
