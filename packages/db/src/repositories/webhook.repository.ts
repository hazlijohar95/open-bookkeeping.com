import { eq, and, desc, inArray, lte, sql } from "drizzle-orm";
import { db } from "../index";
import {
  webhooks,
  webhookDeliveries,
  type Webhook,
  type WebhookEvent,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from "../schema";
import crypto from "crypto";

// Generate a secure webhook secret
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface CreateWebhookInput {
  userId: string;
  url: string;
  events: WebhookEvent[];
  description?: string;
}

export interface UpdateWebhookInput {
  url?: string;
  events?: WebhookEvent[];
  description?: string;
  isActive?: boolean;
}

export interface WebhookQueryOptions {
  limit?: number;
  offset?: number;
  includeInactive?: boolean;
}

export interface DeliveryQueryOptions {
  status?: WebhookDeliveryStatus;
  limit?: number;
  offset?: number;
}

export const webhookRepository = {
  /**
   * Find webhook by ID
   */
  findById: async (id: string, userId: string): Promise<Webhook | undefined> => {
    return db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });
  },

  /**
   * List all webhooks for a user
   */
  findMany: async (
    userId: string,
    options?: WebhookQueryOptions
  ): Promise<Webhook[]> => {
    const { limit = 50, offset = 0, includeInactive = false } = options ?? {};

    const conditions = [eq(webhooks.userId, userId)];
    if (!includeInactive) {
      conditions.push(eq(webhooks.isActive, true));
    }

    return db.query.webhooks.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(webhooks.createdAt)],
    });
  },

  /**
   * Find webhooks subscribed to an event
   */
  findByEvent: async (
    userId: string,
    event: WebhookEvent
  ): Promise<Webhook[]> => {
    // Get all active webhooks for user
    const userWebhooks = await db.query.webhooks.findMany({
      where: and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)),
    });

    // Filter by event subscription
    return userWebhooks.filter((webhook) => {
      const events = webhook.events ?? [];
      return events.includes(event);
    });
  },

  /**
   * Create a new webhook
   */
  create: async (input: CreateWebhookInput): Promise<Webhook> => {
    const secret = generateWebhookSecret();

    const [webhook] = await db
      .insert(webhooks)
      .values({
        userId: input.userId,
        url: input.url,
        secret,
        events: input.events,
        description: input.description,
      })
      .returning();

    return webhook!;
  },

  /**
   * Update webhook settings
   */
  update: async (
    id: string,
    userId: string,
    input: UpdateWebhookInput
  ): Promise<Webhook | undefined> => {
    const existing = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });

    if (!existing) {
      return undefined;
    }

    const [updated] = await db
      .update(webhooks)
      .set({
        url: input.url ?? existing.url,
        events: input.events !== undefined ? input.events : existing.events,
        description:
          input.description !== undefined
            ? input.description
            : existing.description,
        isActive:
          input.isActive !== undefined ? input.isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
      .returning();

    return updated;
  },

  /**
   * Delete a webhook
   */
  delete: async (id: string, userId: string): Promise<boolean> => {
    const existing = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });

    if (!existing) {
      return false;
    }

    await db
      .delete(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)));

    return true;
  },

  /**
   * Rotate webhook secret
   */
  rotateSecret: async (
    id: string,
    userId: string
  ): Promise<{ webhook: Webhook; secret: string } | null> => {
    const existing = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, id), eq(webhooks.userId, userId)),
    });

    if (!existing) {
      return null;
    }

    const newSecret = generateWebhookSecret();

    const [updated] = await db
      .update(webhooks)
      .set({
        secret: newSecret,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, id))
      .returning();

    return { webhook: updated!, secret: newSecret };
  },

  // =====================
  // DELIVERY METHODS
  // =====================

  /**
   * Create a delivery record
   */
  createDelivery: async (input: {
    webhookId: string;
    event: WebhookEvent;
    eventId: string;
    payload: Record<string, unknown>;
  }): Promise<WebhookDelivery> => {
    const [delivery] = await db
      .insert(webhookDeliveries)
      .values({
        webhookId: input.webhookId,
        event: input.event,
        eventId: input.eventId,
        payload: input.payload,
        status: "pending",
      })
      .returning();

    return delivery!;
  },

  /**
   * Update delivery status
   */
  updateDeliveryStatus: async (
    deliveryId: string,
    update: {
      status: WebhookDeliveryStatus;
      statusCode?: number;
      responseBody?: string;
      responseTimeMs?: number;
      errorMessage?: string;
      nextRetryAt?: Date;
    }
  ): Promise<void> => {
    await db
      .update(webhookDeliveries)
      .set({
        status: update.status,
        statusCode: update.statusCode,
        responseBody: update.responseBody,
        responseTimeMs: update.responseTimeMs,
        errorMessage: update.errorMessage,
        nextRetryAt: update.nextRetryAt,
        attempts: sql`${webhookDeliveries.attempts} + 1`,
        deliveredAt: update.status === "success" ? new Date() : undefined,
        failedAt: update.status === "failed" ? new Date() : undefined,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  },

  /**
   * Get delivery by ID
   */
  findDeliveryById: async (
    deliveryId: string,
    userId: string
  ): Promise<WebhookDelivery | undefined> => {
    // Verify ownership through webhook
    const delivery = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.id, deliveryId),
      with: {
        webhook: true,
      },
    });

    if (!delivery || (delivery.webhook as Webhook)?.userId !== userId) {
      return undefined;
    }

    return delivery;
  },

  /**
   * List deliveries for a webhook
   */
  findDeliveries: async (
    webhookId: string,
    userId: string,
    options?: DeliveryQueryOptions
  ): Promise<WebhookDelivery[]> => {
    // Verify ownership
    const webhook = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)),
    });

    if (!webhook) {
      return [];
    }

    const { status, limit = 50, offset = 0 } = options ?? {};

    const conditions = [eq(webhookDeliveries.webhookId, webhookId)];
    if (status) {
      conditions.push(eq(webhookDeliveries.status, status));
    }

    return db.query.webhookDeliveries.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(webhookDeliveries.createdAt)],
    });
  },

  /**
   * Get deliveries pending retry
   */
  findPendingRetries: async (limit = 100): Promise<WebhookDelivery[]> => {
    const now = new Date();

    return db.query.webhookDeliveries.findMany({
      where: and(
        inArray(webhookDeliveries.status, ["pending", "retrying"]),
        lte(webhookDeliveries.nextRetryAt, now)
      ),
      limit,
      orderBy: [webhookDeliveries.nextRetryAt],
      with: {
        webhook: true,
      },
    });
  },

  /**
   * Mark delivery as permanently failed (max retries reached)
   */
  markDeliveryFailed: async (
    deliveryId: string,
    errorMessage: string
  ): Promise<void> => {
    await db
      .update(webhookDeliveries)
      .set({
        status: "failed",
        errorMessage,
        failedAt: new Date(),
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  },

  /**
   * Count active webhooks for a user
   */
  countActive: async (userId: string): Promise<number> => {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhooks)
      .where(and(eq(webhooks.userId, userId), eq(webhooks.isActive, true)));

    return result?.count ?? 0;
  },

  /**
   * Get webhook statistics
   */
  getStats: async (
    webhookId: string,
    userId: string
  ): Promise<{
    totalDeliveries: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
    avgResponseTime: number;
  } | null> => {
    // Verify ownership
    const webhook = await db.query.webhooks.findFirst({
      where: and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)),
    });

    if (!webhook) {
      return null;
    }

    const [stats] = await db
      .select({
        totalDeliveries: sql<number>`count(*)::int`,
        successCount: sql<number>`sum(case when ${webhookDeliveries.status} = 'success' then 1 else 0 end)::int`,
        failedCount: sql<number>`sum(case when ${webhookDeliveries.status} = 'failed' then 1 else 0 end)::int`,
        pendingCount: sql<number>`sum(case when ${webhookDeliveries.status} in ('pending', 'retrying') then 1 else 0 end)::int`,
        avgResponseTime: sql<number>`coalesce(avg(${webhookDeliveries.responseTimeMs}), 0)::int`,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId));

    return (
      stats ?? {
        totalDeliveries: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        avgResponseTime: 0,
      }
    );
  },
};

export type WebhookRepository = typeof webhookRepository;
