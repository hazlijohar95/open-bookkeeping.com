/**
 * Security Headers Middleware
 * Adds essential security headers to all responses
 */

import type { Context, Next } from "hono";
import { v4 as uuidv4 } from "uuid";

export async function securityHeaders(c: Context, next: Next) {
  // Generate request ID for tracing
  const requestId = c.req.header("x-request-id") || uuidv4();

  // Set request ID header early so it's available in error handlers
  c.header("X-Request-Id", requestId);

  await next();

  // Add security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy - adjust based on your needs
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co"
  );

  // Prevent MIME type sniffing
  c.header("X-Download-Options", "noopen");

  // Only in production: HSTS
  if (process.env.NODE_ENV === "production") {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
}

/**
 * Request logging middleware
 */
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;
  // Get request ID from response header (set by securityHeaders middleware)
  const requestId = c.res.headers.get("X-Request-Id") || "unknown";

  // Log request details
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      method,
      path,
      status,
      duration,
      userAgent: c.req.header("user-agent"),
    })
  );
}
