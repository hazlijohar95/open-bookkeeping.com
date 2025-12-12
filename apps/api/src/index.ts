import { serve } from "@hono/node-server";
import { app } from "./app";
import { closeQueues } from "./lib/queue";
import { startWorkers, stopWorkers } from "./workers";

const port = Number(process.env.PORT) || 3001;

// Get allowed origins from environment for logging
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

if (process.env.PRODUCTION_URL) {
  allowedOrigins.push(process.env.PRODUCTION_URL);
}

// Start workers in production (or if explicitly enabled)
const enableWorkers = process.env.ENABLE_WORKERS === "true" || process.env.NODE_ENV === "production";
if (enableWorkers) {
  try {
    startWorkers();
  } catch (error) {
    console.warn("Failed to start workers (Redis may not be configured):", error);
  }
}

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
    console.log(`Environment: ${process.env.NODE_ENV ?? "development"}`);
    console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
    console.log(`Workers: ${enableWorkers ? "enabled" : "disabled"}`);
  }
);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // Stop accepting new connections
    server.close();

    // Stop workers
    if (enableWorkers) {
      await stopWorkers();
    }

    // Close queue connections
    await closeQueues();

    console.log("Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
