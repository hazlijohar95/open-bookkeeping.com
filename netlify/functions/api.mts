import type { Context } from "@netlify/functions";

// Import the Hono app
// Note: We import the app.ts file which exports the configured Hono app
import { createApp } from "../../apps/api/src/app";

// Create the app instance
const app = createApp();

// Netlify Function handler
export default async function handler(request: Request, context: Context) {
  // Convert the Netlify request to a format Hono understands
  // The URL needs to be reconstructed for the Hono app
  const url = new URL(request.url);

  // Hono's fetch method handles the request
  return app.fetch(request, {
    // Pass the Netlify context if needed
    netlifyContext: context,
  });
}

// Configure which paths this function handles
// This tells Netlify to route these paths to this function
export const config = {
  path: [
    "/api/*",
    "/trpc/*",
    "/health",
    "/health/*",
    "/customers/*",
    "/vendors/*",
    "/invoices/*",
    "/quotations/*",
    "/bills/*",
    "/fixed-assets/*",
    "/dashboard/*",
    "/api-keys/*",
    "/webhooks/*",
    "/settings/*",
    "/storage/*",
    "/einvoice/*",
    "/sst/*",
    "/chart-of-accounts/*",
    "/ledger/*",
    "/bank-feed/*",
  ],
};
