/**
 * Workers Index
 * Exports all workers for the application
 */

export { aggregationWorker } from "./aggregation.worker";
export { webhookWorker, processPendingRetries } from "./webhook.worker";

// Function to start all workers
export const startWorkers = () => {
  console.log("[Workers] Starting background workers...");

  // Workers auto-start when imported
  // This function exists for explicit startup and future worker additions

  console.log("[Workers] Aggregation worker started");
  console.log("[Workers] Webhook worker started");

  return {
    aggregation: true,
    webhook: true,
  };
};

// Function to gracefully stop all workers
export const stopWorkers = async () => {
  console.log("[Workers] Stopping background workers...");

  const { aggregationWorker } = await import("./aggregation.worker");
  const { webhookWorker } = await import("./webhook.worker");

  await Promise.all([
    aggregationWorker.close(),
    webhookWorker.close(),
  ]);

  console.log("[Workers] All workers stopped");
};
