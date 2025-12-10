/**
 * Open API v1 Routes
 * Public API endpoints authenticated via API keys
 *
 * Base path: /api/v1
 *
 * All routes use standardized response envelopes:
 * - Success: { data: T, meta: { requestId, timestamp } }
 * - List: { data: T[], pagination: {...}, meta: {...} }
 * - Error: { error: { code, message, details? }, meta: {...} }
 *
 * Rate limits (per API key):
 * - Read operations (GET): 1000 requests/minute
 * - Write operations (POST/PUT/DELETE): 100 requests/minute
 * - Webhook management: 50 requests/minute
 */

import { Hono } from "hono";
import { apiKeyAuth } from "../../middleware/api-key-auth";
import { apiV1RateLimit, apiV1WebhookRateLimit } from "../../middleware/rate-limit";
import { defaultTimeout } from "../../middleware/timeout";

// Import resource routers
import { customersRouter } from "./customers";
import { vendorsRouter } from "./vendors";
import { invoicesRouter } from "./invoices";
import { quotationsRouter } from "./quotations";
import { billsRouter } from "./bills";
import { accountsRouter } from "./accounts";
import { webhooksRouter } from "./webhooks";

// Create v1 router
const v1 = new Hono();

// Apply API key authentication to all v1 routes
v1.use("/*", apiKeyAuth);

// Apply request timeout (30 seconds default)
v1.use("/*", defaultTimeout);

// Apply method-based rate limiting (GET: 1000/min, POST/PUT/DELETE: 100/min)
v1.use("/*", apiV1RateLimit);

// Stricter rate limit for webhook management (50/min)
v1.use("/webhooks/*", apiV1WebhookRateLimit);

// Mount resource routers
v1.route("/customers", customersRouter);
v1.route("/vendors", vendorsRouter);
v1.route("/invoices", invoicesRouter);
v1.route("/quotations", quotationsRouter);
v1.route("/bills", billsRouter);
v1.route("/accounts", accountsRouter);
v1.route("/webhooks", webhooksRouter);

// API info endpoint
v1.get("/", (c) => {
  return c.json({
    name: "Open Bookkeeping API",
    version: "1.0.0",
    documentation: "https://open-bookkeeping.com/docs/api",
    endpoints: {
      customers: "/api/v1/customers",
      vendors: "/api/v1/vendors",
      invoices: "/api/v1/invoices",
      quotations: "/api/v1/quotations",
      bills: "/api/v1/bills",
      accounts: "/api/v1/accounts",
      webhooks: "/api/v1/webhooks",
    },
  });
});

export { v1 as v1Router };
