import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { trpcServer } from "@hono/trpc-server";
import * as Sentry from "@sentry/node";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";
import {
  aiRoutes,
  customerRoutes,
  vendorRoutes,
  invoiceRoutes,
  quotationRoutes,
  billRoutes,
  fixedAssetRoutes,
  dashboardRoutes,
  apiKeyRoutes,
  webhookRoutes,
  settingsRoutes,
  storageRoutes,
  einvoiceRoutes,
  sstRoutes,
  chartOfAccountsRoutes,
  ledgerRoutes,
  bankFeedRoutes,
  statementRoutes,
} from "./routes";
import { v1Router } from "./routes/v1";
import { docsRouter } from "./routes/docs";
import { securityHeaders, requestLogger } from "./middleware/security";
import { generalRateLimit, aiRateLimit } from "./middleware/rate-limit";
import { getQueueStats } from "./lib/queue";
import { isRedisAvailable } from "./lib/redis";
import { db } from "@open-bookkeeping/db";
import { sql } from "drizzle-orm";

// Initialize Sentry for error tracking (if configured)
const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

// Create Hono app
export function createApp() {
  const app = new Hono();

  // Get allowed origins from environment
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:5173", "http://localhost:3000"];

  // Add production origins if configured
  if (process.env.PRODUCTION_URL) {
    allowedOrigins.push(process.env.PRODUCTION_URL);
  }

  // Apply middleware in order
  // 1. Security headers first
  app.use("/*", securityHeaders);

  // 2. Request logging
  app.use("/*", requestLogger);

  // 3. CORS configuration - dynamic based on environment
  app.use(
    "/*",
    cors({
      origin: (origin) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return null;

        // Check against allowed origins
        if (allowedOrigins.includes(origin)) {
          return origin;
        }

        // In development, also allow any localhost origin
        if (
          process.env.NODE_ENV !== "production" &&
          origin.includes("localhost")
        ) {
          return origin;
        }

        console.warn(`CORS blocked origin: ${origin}`);
        return null;
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-API-Key", "User-Agent"],
      exposeHeaders: [
        "X-Request-Id",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      maxAge: 86400, // 24 hours
    })
  );

  // 4. Compression for responses (exclude AI streaming routes)
  app.use("/*", async (c, next) => {
    // Skip compression for AI chat endpoint (streaming)
    if (c.req.path.startsWith("/api/ai/chat")) {
      return next();
    }
    return compress()(c, next);
  });

  // 5. General rate limiting for all routes
  app.use("/*", generalRateLimit);

  // Health check endpoint (no rate limit)
  app.get("/", (c) =>
    c.json({
      status: "ok",
      service: "open-bookkeeping-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    })
  );

  // Health check with comprehensive status
  app.get("/health", async (c) => {
    const startTime = Date.now();

    // Check all dependencies
    const [redisOk, dbOk] = await Promise.all([
      isRedisAvailable(),
      checkDatabaseHealth(),
    ]);

    const responseTime = Date.now() - startTime;
    const status = redisOk && dbOk ? "healthy" : "degraded";

    return c.json({
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      dependencies: {
        redis: redisOk ? "ok" : "unavailable",
        database: dbOk ? "ok" : "unavailable",
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
      },
    });
  });

  // Queue statistics endpoint (protected - requires secret header in production)
  app.get("/health/queues", async (c) => {
    // In production, require a secret header to access queue stats
    if (process.env.NODE_ENV === "production") {
      const adminSecret = process.env.ADMIN_HEALTH_SECRET;
      const providedSecret = c.req.header("x-admin-secret");

      if (!adminSecret || providedSecret !== adminSecret) {
        return c.json({
          status: "error",
          message: "Unauthorized",
          timestamp: new Date().toISOString(),
        }, 401);
      }
    }

    try {
      const stats = await getQueueStats();
      return c.json({
        status: "ok",
        queues: stats,
        timestamp: new Date().toISOString(),
      });
    } catch {
      return c.json({
        status: "error",
        message: "Failed to get queue stats",
        timestamp: new Date().toISOString(),
      }, 500);
    }
  });

  // AI routes with stricter rate limiting
  app.use("/api/ai/*", aiRateLimit);
  app.route("/api/ai", aiRoutes);

  // ============================================
  // Open API v1 Routes (Public API with API Key Auth)
  // ============================================
  app.route("/api/v1", v1Router);

  // ============================================
  // API Documentation (Swagger UI + OpenAPI spec)
  // ============================================
  app.route("/api/docs", docsRouter);
  app.get("/api/openapi.json", (c) => c.redirect("/api/docs/openapi.json"));
  app.get("/api/openapi.yaml", (c) => c.redirect("/api/docs/openapi.yaml"));

  // REST API routes (mirrors Supabase Edge Functions for local development)
  app.route("/customers", customerRoutes);
  app.route("/vendors", vendorRoutes);
  app.route("/invoices", invoiceRoutes);
  app.route("/quotations", quotationRoutes);
  app.route("/bills", billRoutes);
  app.route("/fixed-assets", fixedAssetRoutes);
  app.route("/dashboard", dashboardRoutes);
  app.route("/api-keys", apiKeyRoutes);
  app.route("/webhooks", webhookRoutes);
  app.route("/settings", settingsRoutes);
  app.route("/storage", storageRoutes);
  app.route("/einvoice", einvoiceRoutes);
  app.route("/sst", sstRoutes);
  app.route("/chart-of-accounts", chartOfAccountsRoutes);
  app.route("/ledger", ledgerRoutes);
  app.route("/bank-feed", bankFeedRoutes);
  app.route("/statements", statementRoutes);

  // tRPC handler
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext,
      onError: ({ error, path }) => {
        // Log error to Sentry if configured
        if (sentryDsn) {
          Sentry.captureException(error, {
            tags: { path },
          });
        }
        console.error(`tRPC error on ${path}:`, error.message);
      },
    })
  );

  // Global error handler
  app.onError((err, c) => {
    // Get request ID from header (set by security middleware)
    const requestId = c.res.headers.get("X-Request-Id") ?? "unknown";

    // Log to Sentry
    if (sentryDsn) {
      Sentry.captureException(err, {
        tags: { requestId: String(requestId) },
      });
    }

    console.error(`Unhandled error [${requestId}]:`, err);

    // Don't expose internal error details in production
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message;

    return c.json(
      {
        error: "Internal Server Error",
        message,
        requestId,
      },
      500
    );
  });

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        error: "Not Found",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404
    );
  });

  return app;
}

// Database health check helper
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

// Export the app instance for serverless environments
export const app = createApp();
