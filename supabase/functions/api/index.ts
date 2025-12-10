/**
 * Open-Invoicing API - Supabase Edge Function
 * Main entry point for all API routes using Hono framework
 */

import { Hono } from "npm:hono@4";
import { cors } from "npm:hono@4/cors";
import { logger } from "npm:hono@4/logger";
import { secureHeaders } from "npm:hono@4/secure-headers";
import { createClient } from "npm:@supabase/supabase-js@2";

// Import shared utilities
import { createAuthMiddleware, type AuthContext } from "../_shared/auth.ts";
import { createDbClient } from "../_shared/db.ts";

// Import route modules
import customersRoutes from "./routes/customers.ts";
import vendorsRoutes from "./routes/vendors.ts";
import blogsRoutes from "./routes/blogs.ts";
import settingsRoutes from "./routes/settings.ts";
import invoicesRoutes from "./routes/invoices.ts";
import quotationsRoutes from "./routes/quotations.ts";
import billsRoutes from "./routes/bills.ts";
import creditNotesRoutes from "./routes/credit-notes.ts";
import debitNotesRoutes from "./routes/debit-notes.ts";
import dashboardRoutes from "./routes/dashboard.ts";
import einvoiceRoutes from "./routes/einvoice.ts";
import sstRoutes from "./routes/sst.ts";
import vaultRoutes from "./routes/vault.ts";
import storageRoutes from "./routes/storage.ts";
import bankFeedRoutes from "./routes/bank-feed.ts";
import statementsRoutes from "./routes/statements.ts";
import ledgerRoutes from "./routes/ledger.ts";

// Type augmentation for Hono context
declare module "npm:hono@4" {
  interface ContextVariableMap {
    user: AuthContext["user"];
    supabase: ReturnType<typeof createClient>;
  }
}

const app = new Hono();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Security headers
app.use("*", secureHeaders());

// Request logging
app.use("*", logger());

// CORS configuration
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || [];

      // Allow requests with no origin (like mobile apps)
      if (!origin) return null;

      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // In development, allow localhost
      if (Deno.env.get("ENVIRONMENT") !== "production" && origin.includes("localhost")) {
        return origin;
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
  })
);

// =============================================================================
// HEALTH CHECK (no auth required)
// =============================================================================

app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "open-invoicing-api",
    version: "2.0.0",
    runtime: "supabase-edge",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", async (c) => {
  const db = createDbClient();

  try {
    // Test database connection
    const { error } = await db.from("users").select("id").limit(1);

    return c.json({
      status: error ? "degraded" : "healthy",
      database: error ? "error" : "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({
      status: "unhealthy",
      database: "disconnected",
      error: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

// =============================================================================
// PUBLIC ROUTES (no auth required)
// =============================================================================

// Blog routes are public
app.route("/blogs", blogsRoutes);

// =============================================================================
// PROTECTED ROUTES (auth required)
// =============================================================================

// Apply auth middleware to protected routes
const authMiddleware = createAuthMiddleware();

// Customers
app.use("/customers/*", authMiddleware);
app.use("/customers", authMiddleware);
app.route("/customers", customersRoutes);

// Vendors
app.use("/vendors/*", authMiddleware);
app.use("/vendors", authMiddleware);
app.route("/vendors", vendorsRoutes);

// Settings
app.use("/settings/*", authMiddleware);
app.use("/settings", authMiddleware);
app.route("/settings", settingsRoutes);

// Invoices
app.use("/invoices/*", authMiddleware);
app.use("/invoices", authMiddleware);
app.route("/invoices", invoicesRoutes);

// Quotations
app.use("/quotations/*", authMiddleware);
app.use("/quotations", authMiddleware);
app.route("/quotations", quotationsRoutes);

// Bills
app.use("/bills/*", authMiddleware);
app.use("/bills", authMiddleware);
app.route("/bills", billsRoutes);

// Credit Notes
app.use("/credit-notes/*", authMiddleware);
app.use("/credit-notes", authMiddleware);
app.route("/credit-notes", creditNotesRoutes);

// Debit Notes
app.use("/debit-notes/*", authMiddleware);
app.use("/debit-notes", authMiddleware);
app.route("/debit-notes", debitNotesRoutes);

// Dashboard
app.use("/dashboard/*", authMiddleware);
app.use("/dashboard", authMiddleware);
app.route("/dashboard", dashboardRoutes);

// E-Invoice (MyInvois)
app.use("/einvoice/*", authMiddleware);
app.use("/einvoice", authMiddleware);
app.route("/einvoice", einvoiceRoutes);

// SST (Sales & Service Tax)
app.use("/sst/*", authMiddleware);
app.use("/sst", authMiddleware);
app.route("/sst", sstRoutes);

// Vault (Document Storage)
app.use("/vault/*", authMiddleware);
app.use("/vault", authMiddleware);
app.route("/vault", vaultRoutes);

// Storage (Logos & Signatures)
app.use("/storage/*", authMiddleware);
app.use("/storage", authMiddleware);
app.route("/storage", storageRoutes);

// Bank Feed
app.use("/bank-feed/*", authMiddleware);
app.use("/bank-feed", authMiddleware);
app.route("/bank-feed", bankFeedRoutes);

// Statements
app.use("/statements/*", authMiddleware);
app.use("/statements", authMiddleware);
app.route("/statements", statementsRoutes);

// Ledger (Financial Reports)
app.use("/ledger/*", authMiddleware);
app.use("/ledger", authMiddleware);
app.route("/ledger", ledgerRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.onError((err, c) => {
  console.error("Unhandled error:", err);

  return c.json({
    error: Deno.env.get("ENVIRONMENT") === "production"
      ? "An internal error occurred"
      : err.message,
    requestId: c.req.header("x-request-id"),
  }, 500);
});

app.notFound((c) => {
  return c.json({
    error: "Not found",
    path: c.req.path,
  }, 404);
});

// =============================================================================
// EXPORT
// =============================================================================

Deno.serve(app.fetch);
