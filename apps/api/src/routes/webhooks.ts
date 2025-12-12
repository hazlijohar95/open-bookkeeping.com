/**
 * Webhooks REST Routes
 * Provides REST API endpoints for managing webhooks
 */

import { Hono } from "hono";
import { z } from "zod";
import { webhookRepository, type WebhookEvent } from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";

export const webhookRoutes = new Hono();

// Available webhook events
const WEBHOOK_EVENTS: WebhookEvent[] = [
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
  // E-Invoice events
  "einvoice.submitted",
  "einvoice.validated",
  "einvoice.rejected",
  "einvoice.cancelled",
  // Bill events
  "bill.created",
  "bill.updated",
  "bill.paid",
  // Quotation events
  "quotation.created",
  "quotation.updated",
  "quotation.accepted",
  "quotation.rejected",
  "quotation.converted",
  // Credit/Debit note events
  "credit-note.created",
  "credit-note.applied",
  "debit-note.created",
  "debit-note.applied",
];

// Input validation schemas
const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
  description: z.string().max(500).optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

// GET /webhooks/events - Get available webhook events
webhookRoutes.get("/events", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  return c.json({
    events: WEBHOOK_EVENTS,
    categories: {
      invoice: WEBHOOK_EVENTS.filter((e) => e.startsWith("invoice.")),
      payment: WEBHOOK_EVENTS.filter((e) => e.startsWith("payment.")),
      customer: WEBHOOK_EVENTS.filter((e) => e.startsWith("customer.")),
      vendor: WEBHOOK_EVENTS.filter((e) => e.startsWith("vendor.")),
      einvoice: WEBHOOK_EVENTS.filter((e) => e.startsWith("einvoice.")),
      bill: WEBHOOK_EVENTS.filter((e) => e.startsWith("bill.")),
    },
  });
});

// GET /webhooks - List all webhooks
webhookRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) ?? 0;
    const includeInactive = c.req.query("include_inactive") === "true";

    const webhooks = await webhookRepository.findMany(user.id, {
      limit,
      offset,
      includeInactive,
    });

    // Mask secrets
    const maskedWebhooks = webhooks.map((webhook) => ({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    }));

    return c.json(maskedWebhooks);
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch webhooks");
  }
});

// GET /webhooks/:id - Get single webhook
webhookRoutes.get("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const webhook = await webhookRepository.findById(id, user.id);

    if (!webhook) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    return c.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching webhook:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch webhook");
  }
});

// GET /webhooks/:id/secret - Get webhook secret (sensitive)
webhookRoutes.get("/:id/secret", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const webhook = await webhookRepository.findById(id, user.id);

    if (!webhook) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    return c.json({ secret: webhook.secret });
  } catch (error) {
    console.error("Error fetching webhook secret:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch webhook secret");
  }
});

// GET /webhooks/:id/stats - Get webhook statistics
webhookRoutes.get("/:id/stats", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const stats = await webhookRepository.getStats(id, user.id);

    if (!stats) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    return c.json(stats);
  } catch (error) {
    console.error("Error fetching webhook stats:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch webhook statistics");
  }
});

// GET /webhooks/:id/deliveries - Get webhook deliveries
webhookRoutes.get("/:id/deliveries", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const status = c.req.query("status") as any;
    const limit = Number(c.req.query("limit")) || 50;
    const offset = Number(c.req.query("offset")) ?? 0;

    const deliveries = await webhookRepository.findDeliveries(id, user.id, {
      status,
      limit,
      offset,
    });

    return c.json(deliveries);
  } catch (error) {
    console.error("Error fetching webhook deliveries:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch deliveries");
  }
});

// POST /webhooks - Create new webhook
webhookRoutes.post("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = createWebhookSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { url, events, description } = validation.data;

    // Validate events
    const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, `Invalid events: ${invalidEvents.join(", ")}`);
    }

    // Check existing webhook count (limit to 10 per user)
    const existingCount = await webhookRepository.countActive(user.id);
    if (existingCount >= 10) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Maximum number of webhooks (10) reached");
    }

    const webhook = await webhookRepository.create({
      userId: user.id,
      url,
      events: events as WebhookEvent[],
      description,
    });

    // Return with secret (only on creation)
    return c.json(
      {
        id: webhook.id,
        url: webhook.url,
        secret: webhook.secret, // Only time the secret is visible
        events: webhook.events,
        description: webhook.description,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
      },
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error creating webhook:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to create webhook");
  }
});

// PATCH /webhooks/:id - Update webhook
webhookRoutes.patch("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const validation = updateWebhookSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { url, events, description, isActive } = validation.data;

    // Validate events if provided
    if (events) {
      const invalidEvents = events.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return errorResponse(c, HTTP_STATUS.BAD_REQUEST, `Invalid events: ${invalidEvents.join(", ")}`);
      }
    }

    const updated = await webhookRepository.update(id, user.id, {
      url,
      events: events as WebhookEvent[] | undefined,
      description,
      isActive,
    });

    if (!updated) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    return c.json({
      id: updated.id,
      url: updated.url,
      events: updated.events,
      description: updated.description,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update webhook");
  }
});

// POST /webhooks/:id/rotate-secret - Rotate webhook secret
webhookRoutes.post("/:id/rotate-secret", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");

    const result = await webhookRepository.rotateSecret(id, user.id);

    if (!result) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    return c.json({
      id: result.webhook.id,
      secret: result.secret, // New secret
      message: "Secret rotated successfully",
    });
  } catch (error) {
    console.error("Error rotating webhook secret:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to rotate webhook secret");
  }
});

// DELETE /webhooks/:id - Delete webhook
webhookRoutes.delete("/:id", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");

    const deleted = await webhookRepository.delete(id, user.id);

    if (!deleted) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    return c.json({ success: true, message: "Webhook deleted" });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to delete webhook");
  }
});

// POST /webhooks/:id/test - Send test webhook
webhookRoutes.post("/:id/test", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const id = c.req.param("id");
    const webhook = await webhookRepository.findById(id, user.id);

    if (!webhook) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Webhook not found");
    }

    // Create test payload
    const testPayload = {
      event: "test.ping",
      data: {
        message: "This is a test webhook delivery",
        timestamp: new Date().toISOString(),
      },
    };

    // Create a test delivery record
    const delivery = await webhookRepository.createDelivery({
      webhookId: webhook.id,
      event: "invoice.created" as WebhookEvent, // Use a valid event type
      eventId: `test_${Date.now()}`,
      payload: testPayload,
    });

    // Note: Actual delivery would be handled by a background worker
    // For now, just return that the test was queued
    return c.json({
      success: true,
      message: "Test webhook queued for delivery",
      deliveryId: delivery.id,
    });
  } catch (error) {
    console.error("Error sending test webhook:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to send test webhook");
  }
});
