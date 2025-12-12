/**
 * BullMQ Queue Configuration
 * Handles background job processing with Redis
 *
 * NOTE: BullMQ requires a native Redis connection (ioredis-compatible).
 * Upstash REST API is NOT compatible with BullMQ.
 *
 * Configure with:
 * - BULLMQ_REDIS_URL: Full Redis URL (redis://user:pass@host:port)
 * - Or individual: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 *
 * If not configured, queues will be disabled and jobs run synchronously.
 */

import { Queue, ConnectionOptions } from "bullmq";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("queue");

// Track whether BullMQ is available
let bullmqAvailable = false;

// Redis connection for BullMQ (requires native Redis, not Upstash REST)
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
    } catch (e) {
      logger.error({ url: redisUrl }, "Invalid BULLMQ_REDIS_URL format");
      return null;
    }
  }

  // Option 2: Individual environment variables
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  const redisPassword = process.env.REDIS_PASSWORD;

  if (redisHost) {
    return {
      host: redisHost,
      port: parseInt(redisPort ?? "6379", 10),
      password: redisPassword ?? undefined,
    };
  }

  // Not configured - queues will be disabled
  logger.warn(
    "BullMQ Redis not configured. Set BULLMQ_REDIS_URL or REDIS_HOST for background job processing. " +
    "NOTE: Upstash REST API (UPSTASH_REDIS_REST_URL) is NOT compatible with BullMQ."
  );
  return null;
};

const connection = getRedisConnection();
bullmqAvailable = connection !== null;

/**
 * Check if BullMQ queues are available
 */
export function isQueueAvailable(): boolean {
  return bullmqAvailable;
}

// Job types
export type JobName =
  | "aggregation.updateMonthly"
  | "aggregation.rebuildUser"
  | "notification.email"
  | "notification.webhook"
  | "invoice.generatePdf"
  | "sst.calculatePeriod"
  | "webhook.deliver"
  | "webhook.retry";

// Job data types
export interface AggregationUpdateJob {
  userId: string;
  year: number;
  month: number;
}

export interface AggregationRebuildJob {
  userId: string;
}

export interface EmailNotificationJob {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface WebhookNotificationJob {
  url: string;
  payload: Record<string, unknown>;
  retries?: number;
}

export interface InvoicePdfJob {
  invoiceId: string;
  userId: string;
}

export interface SstCalculateJob {
  userId: string;
  period: string; // YYYY-MM format
}

export interface WebhookDeliverJob {
  deliveryId: string;
  webhookId: string;
  userId: string;
  attempt: number;
}

export interface WebhookDispatchJob {
  userId: string;
  event: string;
  data: Record<string, unknown>;
}

// Create queues only if connection is available
// Using type assertion to avoid null checks everywhere - queues are only used when bullmqAvailable is true

export const aggregationQueue = connection
  ? new Queue<AggregationUpdateJob | AggregationRebuildJob>("aggregation", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    })
  : (null as unknown as Queue<AggregationUpdateJob | AggregationRebuildJob>);

export const notificationQueue = connection
  ? new Queue<EmailNotificationJob | WebhookNotificationJob>("notifications", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : (null as unknown as Queue<EmailNotificationJob | WebhookNotificationJob>);

export const invoiceQueue = connection
  ? new Queue<InvoicePdfJob>("invoices", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    })
  : (null as unknown as Queue<InvoicePdfJob>);

export const sstQueue = connection
  ? new Queue<SstCalculateJob>("sst", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    })
  : (null as unknown as Queue<SstCalculateJob>);

export const webhookQueue = connection
  ? new Queue<WebhookDeliverJob | WebhookDispatchJob>("webhooks", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 60000 },
        removeOnComplete: 200,
        removeOnFail: 1000,
      },
    })
  : (null as unknown as Queue<WebhookDeliverJob | WebhookDispatchJob>);

// Helper functions to add jobs
// These return null when queues are not available (graceful degradation)

export const queueAggregationUpdate = async (data: AggregationUpdateJob) => {
  if (!bullmqAvailable) {
    logger.debug({ data }, "Queue unavailable, skipping aggregation update job");
    return null;
  }
  return aggregationQueue.add("aggregation.updateMonthly", data, {
    jobId: `agg-${data.userId}-${data.year}-${data.month}`,
    delay: 5000, // Debounce: wait 5 seconds before processing
  });
};

export const queueAggregationRebuild = async (data: AggregationRebuildJob) => {
  if (!bullmqAvailable) {
    logger.debug({ data }, "Queue unavailable, skipping aggregation rebuild job");
    return null;
  }
  return aggregationQueue.add("aggregation.rebuildUser", data, {
    jobId: `rebuild-${data.userId}`,
    priority: 10, // Lower priority for full rebuilds
  });
};

export const queueEmailNotification = async (data: EmailNotificationJob) => {
  if (!bullmqAvailable) {
    logger.debug({ to: data.to }, "Queue unavailable, skipping email notification job");
    return null;
  }
  return notificationQueue.add("notification.email", data);
};

export const queueWebhookNotification = async (data: WebhookNotificationJob) => {
  if (!bullmqAvailable) {
    logger.debug({ url: data.url }, "Queue unavailable, skipping webhook notification job");
    return null;
  }
  return notificationQueue.add("notification.webhook", data);
};

export const queueInvoicePdf = async (data: InvoicePdfJob) => {
  if (!bullmqAvailable) {
    logger.debug({ invoiceId: data.invoiceId }, "Queue unavailable, skipping PDF generation job");
    return null;
  }
  return invoiceQueue.add("invoice.generatePdf", data, {
    jobId: `pdf-${data.invoiceId}`,
  });
};

export const queueSstCalculation = async (data: SstCalculateJob) => {
  if (!bullmqAvailable) {
    logger.debug({ period: data.period }, "Queue unavailable, skipping SST calculation job");
    return null;
  }
  return sstQueue.add("sst.calculatePeriod", data, {
    jobId: `sst-${data.userId}-${data.period}`,
  });
};

export const queueWebhookDelivery = async (data: WebhookDeliverJob) => {
  if (!bullmqAvailable) {
    logger.debug({ deliveryId: data.deliveryId }, "Queue unavailable, skipping webhook delivery job");
    return null;
  }
  return webhookQueue.add("webhook.deliver", data, {
    jobId: `webhook-${data.deliveryId}-${data.attempt}`,
  });
};

export const queueWebhookDispatch = async (data: WebhookDispatchJob) => {
  if (!bullmqAvailable) {
    logger.debug({ event: data.event }, "Queue unavailable, skipping webhook dispatch job");
    return null;
  }
  return webhookQueue.add("webhook.dispatch", data);
};

// Get queue statistics
export const getQueueStats = async () => {
  if (!bullmqAvailable) {
    return {
      available: false,
      message: "BullMQ queues not configured. Set BULLMQ_REDIS_URL or REDIS_HOST.",
    };
  }

  const [aggStats, notifStats, invStats, sstStats, webhookStats] = await Promise.all([
    aggregationQueue.getJobCounts(),
    notificationQueue.getJobCounts(),
    invoiceQueue.getJobCounts(),
    sstQueue.getJobCounts(),
    webhookQueue.getJobCounts(),
  ]);

  return {
    available: true,
    aggregation: aggStats,
    notifications: notifStats,
    invoices: invStats,
    sst: sstStats,
    webhooks: webhookStats,
  };
};

// Graceful shutdown
export const closeQueues = async () => {
  if (!bullmqAvailable) return;

  await Promise.all([
    aggregationQueue.close(),
    notificationQueue.close(),
    invoiceQueue.close(),
    sstQueue.close(),
    webhookQueue.close(),
  ]);
};
