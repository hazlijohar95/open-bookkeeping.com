/**
 * BullMQ Queue Configuration
 * Handles background job processing with Redis
 */

import { Queue, Worker, Job, ConnectionOptions } from "bullmq";

// Redis connection for BullMQ
const getRedisConnection = (): ConnectionOptions => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    // Extract host and port from Upstash URL for BullMQ
    // Note: BullMQ uses ioredis-compatible connection, not HTTP
    // For Upstash, we need to use their Redis protocol endpoint
    const url = new URL(redisUrl.replace("https://", "rediss://"));
    return {
      host: url.hostname,
      port: 6379,
      password: redisToken,
      tls: {},
    };
  }

  // Fallback to standard Redis
  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
  const redisPassword = process.env.REDIS_PASSWORD;

  return {
    host: redisHost,
    port: redisPort,
    password: redisPassword || undefined,
  };
};

const connection = getRedisConnection();

// Job types
export type JobName =
  | "aggregation.updateMonthly"
  | "aggregation.rebuildUser"
  | "notification.email"
  | "notification.webhook"
  | "invoice.generatePdf"
  | "sst.calculatePeriod";

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

// Create queues
export const aggregationQueue = new Queue<AggregationUpdateJob | AggregationRebuildJob>("aggregation", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

export const notificationQueue = new Queue<EmailNotificationJob | WebhookNotificationJob>("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const invoiceQueue = new Queue<InvoicePdfJob>("invoices", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

export const sstQueue = new Queue<SstCalculateJob>("sst", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

// Helper functions to add jobs
export const queueAggregationUpdate = async (data: AggregationUpdateJob) => {
  return aggregationQueue.add("aggregation.updateMonthly", data, {
    jobId: `agg-${data.userId}-${data.year}-${data.month}`,
    delay: 5000, // Debounce: wait 5 seconds before processing
  });
};

export const queueAggregationRebuild = async (data: AggregationRebuildJob) => {
  return aggregationQueue.add("aggregation.rebuildUser", data, {
    jobId: `rebuild-${data.userId}`,
    priority: 10, // Lower priority for full rebuilds
  });
};

export const queueEmailNotification = async (data: EmailNotificationJob) => {
  return notificationQueue.add("notification.email", data);
};

export const queueWebhookNotification = async (data: WebhookNotificationJob) => {
  return notificationQueue.add("notification.webhook", data);
};

export const queueInvoicePdf = async (data: InvoicePdfJob) => {
  return invoiceQueue.add("invoice.generatePdf", data, {
    jobId: `pdf-${data.invoiceId}`,
  });
};

export const queueSstCalculation = async (data: SstCalculateJob) => {
  return sstQueue.add("sst.calculatePeriod", data, {
    jobId: `sst-${data.userId}-${data.period}`,
  });
};

// Get queue statistics
export const getQueueStats = async () => {
  const [aggStats, notifStats, invStats, sstStats] = await Promise.all([
    aggregationQueue.getJobCounts(),
    notificationQueue.getJobCounts(),
    invoiceQueue.getJobCounts(),
    sstQueue.getJobCounts(),
  ]);

  return {
    aggregation: aggStats,
    notifications: notifStats,
    invoices: invStats,
    sst: sstStats,
  };
};

// Graceful shutdown
export const closeQueues = async () => {
  await Promise.all([
    aggregationQueue.close(),
    notificationQueue.close(),
    invoiceQueue.close(),
    sstQueue.close(),
  ]);
};
