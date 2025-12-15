/**
 * Memory Cleanup Worker
 * Runs scheduled cleanup of expired and unused agent memories
 *
 * NOTE: Requires native Redis (not Upstash REST). Configure with:
 * - BULLMQ_REDIS_URL: Full Redis URL
 * - Or: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 *
 * This worker can also be triggered manually via API endpoint
 */

import { Worker, Job, Queue, ConnectionOptions } from "bullmq";
import { memoryCleanupService, type CleanupConfig } from "../services/memory-cleanup.service";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("memory-cleanup-worker");

// Job types
export interface MemoryCleanupJob {
  config?: Partial<CleanupConfig>;
  triggeredBy?: "scheduled" | "manual" | "api";
  userId?: string; // For user-specific cleanup
}

export interface UserMemoryCleanupJob {
  userId: string;
  action: "deactivate" | "purge";
  category?: string;
  olderThan?: string; // ISO date string
}

// Redis connection for BullMQ workers
const getRedisConnection = (): ConnectionOptions | null => {
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

// Queue for scheduling cleanup jobs
let cleanupQueue: Queue<MemoryCleanupJob | UserMemoryCleanupJob> | null = null;

if (connection) {
  cleanupQueue = new Queue<MemoryCleanupJob | UserMemoryCleanupJob>("memory-cleanup", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Keep completed jobs for 24 hours
        count: 100,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
      },
    },
  });
}

// Create worker
function createMemoryCleanupWorker() {
  if (!connection) {
    logger.warn("Memory cleanup worker disabled - BullMQ Redis not configured");
    return {
      on: () => {},
      close: async () => {},
      isRunning: () => false,
    } as unknown as Worker<MemoryCleanupJob | UserMemoryCleanupJob>;
  }

  const worker = new Worker<MemoryCleanupJob | UserMemoryCleanupJob>(
    "memory-cleanup",
    async (job: Job<MemoryCleanupJob | UserMemoryCleanupJob>) => {
      const { name, data } = job;

      logger.info({ jobName: name, jobId: job.id }, "Processing memory cleanup job");

      try {
        if (name === "cleanup.full" || name === "cleanup.scheduled") {
          // Full system cleanup
          const cleanupData = data as MemoryCleanupJob;
          const result = await memoryCleanupService.runCleanup(cleanupData.config);

          logger.info(
            {
              jobId: job.id,
              triggeredBy: cleanupData.triggeredBy,
              result,
            },
            "Memory cleanup completed"
          );

          return result;
        }

        if (name === "cleanup.user") {
          // User-specific cleanup
          const userData = data as UserMemoryCleanupJob;

          if (userData.action === "deactivate") {
            const count = await memoryCleanupService.deactivateUserMemories(
              userData.userId,
              {
                category: userData.category,
                olderThan: userData.olderThan ? new Date(userData.olderThan) : undefined,
              }
            );
            return { action: "deactivate", count };
          }

          if (userData.action === "purge") {
            const count = await memoryCleanupService.purgeDeactivatedMemories(userData.userId);
            return { action: "purge", count };
          }
        }

        return { success: true };
      } catch (error) {
        logger.error({ error, jobName: name, jobId: job.id }, "Memory cleanup job failed");
        throw error;
      }
    },
    {
      connection,
      concurrency: 1, // Run one cleanup at a time
      limiter: {
        max: 5,
        duration: 60000,
      },
    }
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    logger.debug({ jobId: job.id, result }, "Memory cleanup job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, "Memory cleanup job failed");
  });

  worker.on("error", (err) => {
    logger.error({ error: err }, "Memory cleanup worker error");
  });

  logger.info("Memory cleanup worker started");
  return worker;
}

export const memoryCleanupWorker = createMemoryCleanupWorker();

/**
 * Schedule the daily cleanup job
 * Call this on application startup
 */
export async function scheduleCleanupJobs() {
  if (!cleanupQueue) {
    logger.warn("Cannot schedule cleanup jobs - queue not available");
    return;
  }

  // Remove any existing repeatable jobs
  const existingJobs = await cleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === "cleanup.scheduled") {
      await cleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule daily cleanup at 3 AM
  await cleanupQueue.add(
    "cleanup.scheduled",
    {
      triggeredBy: "scheduled",
    },
    {
      repeat: {
        pattern: "0 3 * * *", // 3 AM daily
        tz: "Asia/Kuala_Lumpur",
      },
    }
  );

  logger.info("Scheduled daily memory cleanup job at 3 AM MYT");
}

/**
 * Trigger a manual cleanup job
 */
export async function triggerManualCleanup(
  config?: Partial<CleanupConfig>
): Promise<string | null> {
  if (!cleanupQueue) {
    // Fallback: run cleanup directly without queue
    logger.info("Running cleanup directly (no queue available)");
    await memoryCleanupService.runCleanup(config);
    return null;
  }

  const job = await cleanupQueue.add("cleanup.full", {
    config,
    triggeredBy: "manual",
  });

  logger.info({ jobId: job.id }, "Manual cleanup job queued");
  return job.id ?? null;
}

/**
 * Queue a user-specific cleanup job
 */
export async function queueUserCleanup(
  userId: string,
  action: "deactivate" | "purge",
  options?: { category?: string; olderThan?: Date }
): Promise<string | null> {
  if (!cleanupQueue) {
    // Fallback: run cleanup directly
    if (action === "deactivate") {
      await memoryCleanupService.deactivateUserMemories(userId, options);
    } else {
      await memoryCleanupService.purgeDeactivatedMemories(userId);
    }
    return null;
  }

  const job = await cleanupQueue.add("cleanup.user", {
    userId,
    action,
    category: options?.category,
    olderThan: options?.olderThan?.toISOString(),
  });

  return job.id ?? null;
}

/**
 * Get cleanup job status
 */
export async function getCleanupJobStatus(jobId: string) {
  if (!cleanupQueue) {
    return null;
  }

  const job = await cleanupQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
  };
}
