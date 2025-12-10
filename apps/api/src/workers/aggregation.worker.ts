/**
 * Aggregation Worker
 * Processes background jobs for updating monthly aggregations
 */

import { Worker, Job } from "bullmq";
import { aggregationService } from "../services/aggregation.service";
import type { AggregationUpdateJob, AggregationRebuildJob } from "../lib/queue";

// Redis connection (same as queue.ts)
const getRedisConnection = () => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    const url = new URL(redisUrl.replace("https://", "rediss://"));
    return {
      host: url.hostname,
      port: 6379,
      password: redisToken,
      tls: {},
    };
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
};

export const aggregationWorker = new Worker<AggregationUpdateJob | AggregationRebuildJob>(
  "aggregation",
  async (job: Job<AggregationUpdateJob | AggregationRebuildJob>) => {
    const { name, data } = job;

    console.log(`[Aggregation Worker] Processing job: ${name}`, data);

    try {
      if (name === "aggregation.updateMonthly") {
        const { userId, year, month } = data as AggregationUpdateJob;
        await aggregationService.updateInvoiceMonthlyTotals(userId, year, month);

        // Also update SST totals for the period
        const period = `${year}-${String(month).padStart(2, "0")}`;
        await aggregationService.updateSstMonthlyTotals(userId, period);

        console.log(`[Aggregation Worker] Updated monthly totals for ${userId}: ${period}`);
      } else if (name === "aggregation.rebuildUser") {
        const { userId } = data as AggregationRebuildJob;
        await aggregationService.rebuildAllMonthlyTotals(userId);
        console.log(`[Aggregation Worker] Rebuilt all totals for ${userId}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`[Aggregation Worker] Job failed:`, error);
      throw error;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 100,
      duration: 60000, // Max 100 jobs per minute
    },
  }
);

// Event handlers
aggregationWorker.on("completed", (job) => {
  console.log(`[Aggregation Worker] Job ${job.id} completed`);
});

aggregationWorker.on("failed", (job, err) => {
  console.error(`[Aggregation Worker] Job ${job?.id} failed:`, err.message);
});

aggregationWorker.on("error", (err) => {
  console.error("[Aggregation Worker] Worker error:", err);
});
