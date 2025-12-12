/**
 * Aggregation Worker
 * Processes background jobs for updating monthly aggregations
 *
 * NOTE: Requires native Redis (not Upstash REST). Configure with:
 * - BULLMQ_REDIS_URL: Full Redis URL
 * - Or: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 */

import { Worker, Job, ConnectionOptions } from "bullmq";
import { aggregationService } from "../services/aggregation.service";
import type { AggregationUpdateJob, AggregationRebuildJob } from "../lib/queue";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("aggregation-worker");

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
function createAggregationWorker() {
  if (!connection) {
    logger.warn("Aggregation worker disabled - BullMQ Redis not configured");
    // Return a mock worker object for type compatibility
    return {
      on: () => {},
      close: async () => {},
      isRunning: () => false,
    } as unknown as Worker<AggregationUpdateJob | AggregationRebuildJob>;
  }

  const worker = new Worker<AggregationUpdateJob | AggregationRebuildJob>(
    "aggregation",
    async (job: Job<AggregationUpdateJob | AggregationRebuildJob>) => {
      const { name, data } = job;

      logger.info({ jobName: name, data }, "Processing aggregation job");

      try {
        if (name === "aggregation.updateMonthly") {
          const { userId, year, month } = data as AggregationUpdateJob;
          await aggregationService.updateInvoiceMonthlyTotals(userId, year, month);

          // Also update SST totals for the period
          const period = `${year}-${String(month).padStart(2, "0")}`;
          await aggregationService.updateSstMonthlyTotals(userId, period);

          logger.info({ userId, period }, "Updated monthly totals");
        } else if (name === "aggregation.rebuildUser") {
          const { userId } = data as AggregationRebuildJob;
          await aggregationService.rebuildAllMonthlyTotals(userId);
          logger.info({ userId }, "Rebuilt all totals");
        }

        return { success: true };
      } catch (error) {
        logger.error({ error, jobName: name }, "Aggregation job failed");
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 60000,
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    logger.debug({ jobId: job.id }, "Aggregation job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, "Aggregation job failed");
  });

  worker.on("error", (err) => {
    logger.error({ error: err }, "Aggregation worker error");
  });

  logger.info("Aggregation worker started");
  return worker;
}

export const aggregationWorker = createAggregationWorker();
