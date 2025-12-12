/**
 * Webhook Worker
 * Processes background jobs for webhook delivery
 *
 * NOTE: Requires native Redis (not Upstash REST). Configure with:
 * - BULLMQ_REDIS_URL: Full Redis URL
 * - Or: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 */

import { Worker, Job, ConnectionOptions } from "bullmq";
import {
  webhookRepository,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
} from "@open-bookkeeping/db";
import {
  processDelivery,
  createEventPayload,
  deliverWebhook,
} from "../services/webhook.service";
import type { WebhookDeliverJob, WebhookDispatchJob } from "../lib/queue";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("webhook-worker");

// Redis connection for BullMQ workers
const getRedisConnection = (): ConnectionOptions | null => {
  // Option 1: Full Redis URL
  const redisUrl = process.env.BULLMQ_REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      const isTls = url.protocol === "rediss:";
      return {
        host: url.hostname,
        port: parseInt(url.port || (isTls ? "6380" : "6379"), 10),
        password: url.password ?? undefined,
        username: url.username ?? undefined,
        tls: isTls ? {} : undefined,
      };
    } catch {
      return null;
    }
  }

  // Option 2: Individual environment variables
  const redisHost = process.env.REDIS_HOST;
  if (redisHost) {
    return {
      host: redisHost,
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
    };
  }

  return null;
};

const connection = getRedisConnection();

// Create worker only if Redis connection is available
function createWebhookWorker() {
  if (!connection) {
    logger.warn("Webhook worker disabled - BullMQ Redis not configured");
    // Return a mock worker object for type compatibility
    return {
      on: () => {},
      close: async () => {},
      isRunning: () => false,
    } as unknown as Worker<WebhookDeliverJob | WebhookDispatchJob>;
  }

  const worker = new Worker<WebhookDeliverJob | WebhookDispatchJob>(
    "webhooks",
    async (job: Job<WebhookDeliverJob | WebhookDispatchJob>) => {
      const { name, data } = job;

      logger.info({ jobName: name, jobId: job.id, attempt: job.attemptsMade + 1 }, "Processing webhook job");

      try {
        if (name === "webhook.deliver") {
          // Direct delivery job - process a specific delivery record
          const { deliveryId } = data as WebhookDeliverJob;

          // Get the delivery record with webhook
          const delivery = await webhookRepository.findPendingRetries(1).then(
            (deliveries) => deliveries.find((d) => d.id === deliveryId)
          );

          if (!delivery) {
            // Try to get the delivery directly
            const allDeliveries = await webhookRepository.findPendingRetries(100);
            const targetDelivery = allDeliveries.find(d => d.id === deliveryId);

            if (!targetDelivery) {
              logger.debug({ deliveryId }, "Delivery not found or already processed");
              return { success: true, skipped: true };
            }

            // Process the delivery
            await processDelivery(targetDelivery as WebhookDelivery & { webhook: Webhook });
          } else {
            await processDelivery(delivery as WebhookDelivery & { webhook: Webhook });
          }

          return { success: true };
        } else if (name === "webhook.dispatch") {
          // Dispatch job - find all webhooks subscribed to event and deliver
          const { userId, event, data: eventData } = data as WebhookDispatchJob;

          // Get webhooks subscribed to this event
          const webhooks = await webhookRepository.findByEvent(userId, event as WebhookEvent);

          if (webhooks.length === 0) {
            logger.debug({ event, userId }, "No webhooks subscribed to event");
            return { success: true, delivered: 0 };
          }

          // Create event payload
          const payload = createEventPayload(event as WebhookEvent, eventData);

          // Deliver to each webhook
          const results = await Promise.allSettled(
            webhooks.map(async (webhook) => {
              // Create delivery record
              const delivery = await webhookRepository.createDelivery({
                webhookId: webhook.id,
                event: event as WebhookEvent,
                eventId: payload.id,
                payload: payload as unknown as Record<string, unknown>,
              });

              // Attempt immediate delivery
              const result = await deliverWebhook(webhook.url, payload, webhook.secret);

              // Update delivery status
              if (result.success) {
                await webhookRepository.updateDeliveryStatus(delivery.id, {
                  status: "success",
                  statusCode: result.statusCode,
                  responseBody: result.responseBody,
                  responseTimeMs: result.responseTimeMs,
                });
              } else {
                // Schedule retry
                const nextRetry = new Date(Date.now() + 60 * 1000); // 1 minute
                await webhookRepository.updateDeliveryStatus(delivery.id, {
                  status: "retrying",
                  statusCode: result.statusCode,
                  responseBody: result.responseBody,
                  responseTimeMs: result.responseTimeMs,
                  errorMessage: result.error,
                  nextRetryAt: nextRetry,
                });
              }

              return { webhookId: webhook.id, success: result.success };
            })
          );

          const successCount = results.filter(
            (r) => r.status === "fulfilled" && r.value.success
          ).length;

          logger.info(
            { event, webhookCount: webhooks.length, successCount },
            "Dispatched webhooks"
          );

          return { success: true, delivered: webhooks.length, successful: successCount };
        }

        return { success: true };
      } catch (error) {
        logger.error({ error, jobName: name }, "Webhook job failed");
        throw error;
      }
    },
    {
      connection,
      concurrency: 10, // Process up to 10 webhook deliveries concurrently
      limiter: {
        max: 200,
        duration: 60000, // Max 200 deliveries per minute
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "Webhook job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, "Webhook job failed");
  });

  worker.on("error", (err) => {
    logger.error({ error: err }, "Webhook worker error");
  });

  logger.info("Webhook worker started");
  return worker;
}

export const webhookWorker = createWebhookWorker();

/**
 * Process pending webhook retries
 * This should be called periodically (e.g., via cron or scheduler)
 */
export async function processPendingRetries(): Promise<number> {
  const pendingDeliveries = await webhookRepository.findPendingRetries(100);

  if (pendingDeliveries.length === 0) {
    return 0;
  }

  logger.info({ count: pendingDeliveries.length }, "Processing pending webhook retries");

  for (const delivery of pendingDeliveries) {
    await processDelivery(delivery as WebhookDelivery & { webhook: Webhook });
  }

  return pendingDeliveries.length;
}
