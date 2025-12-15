/**
 * Workers Index
 * Exports all workers for the application
 */

export { aggregationWorker } from "./aggregation.worker";
export { webhookWorker, processPendingRetries } from "./webhook.worker";
export {
  memoryCleanupWorker,
  scheduleCleanupJobs,
  triggerManualCleanup,
  queueUserCleanup,
  getCleanupJobStatus,
} from "./memory-cleanup.worker";

// Function to start all workers
export const startWorkers = async () => {
  console.log("[Workers] Starting background workers...");

  // Workers auto-start when imported
  // This function exists for explicit startup and future worker additions

  console.log("[Workers] Aggregation worker started");
  console.log("[Workers] Webhook worker started");
  console.log("[Workers] Memory cleanup worker started");

  // Schedule the daily memory cleanup job
  const { scheduleCleanupJobs } = await import("./memory-cleanup.worker");
  await scheduleCleanupJobs();

  return {
    aggregation: true,
    webhook: true,
    memoryCleanup: true,
  };
};

// Function to gracefully stop all workers
export const stopWorkers = async () => {
  console.log("[Workers] Stopping background workers...");

  const { aggregationWorker } = await import("./aggregation.worker");
  const { webhookWorker } = await import("./webhook.worker");
  const { memoryCleanupWorker } = await import("./memory-cleanup.worker");

  await Promise.all([
    aggregationWorker.close(),
    webhookWorker.close(),
    memoryCleanupWorker.close(),
  ]);

  console.log("[Workers] All workers stopped");
};
