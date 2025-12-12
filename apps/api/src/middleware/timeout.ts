/**
 * Request Timeout Middleware
 * Prevents requests from hanging indefinitely
 * Returns 408 Request Timeout if exceeded
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("timeout-middleware");

interface TimeoutConfig {
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Custom error message */
  message?: string;
}

// Default timeouts for different types of operations
export const TIMEOUTS = {
  /** Standard API requests: 30 seconds */
  DEFAULT: 30_000,
  /** Quick operations (health checks, simple reads): 10 seconds */
  QUICK: 10_000,
  /** Heavy operations (PDF generation, AI): 120 seconds */
  HEAVY: 120_000,
  /** Webhook delivery: 30 seconds (per request) */
  WEBHOOK: 30_000,
} as const;

/**
 * Create a timeout middleware with configurable duration
 */
export function timeout(config: TimeoutConfig) {
  const { timeoutMs, message = "Request timeout" } = config;

  return async (c: Context, next: Next) => {
    const controller = new AbortController();
    const requestId = c.res.headers.get("X-Request-Id") ?? "unknown";

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        controller.abort();
        logger.warn(
          { requestId, path: c.req.path, method: c.req.method, timeoutMs },
          "Request timed out"
        );
        reject(new HTTPException(408, { message }));
      }, timeoutMs);

      // Clear timeout if request completes
      c.req.raw.signal?.addEventListener("abort", () => clearTimeout(timer));
    });

    // Race between request handling and timeout
    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error) {
      if (error instanceof HTTPException && error.status === 408) {
        return c.json(
          {
            error: "Request Timeout",
            message,
            requestId,
          },
          408
        );
      }
      throw error;
    }
  };
}

/**
 * Default timeout middleware (30 seconds)
 */
export const defaultTimeout = timeout({
  timeoutMs: TIMEOUTS.DEFAULT,
  message: "Request timed out after 30 seconds",
});

/**
 * Quick timeout middleware (10 seconds)
 * Use for health checks, simple lookups
 */
export const quickTimeout = timeout({
  timeoutMs: TIMEOUTS.QUICK,
  message: "Request timed out after 10 seconds",
});

/**
 * Heavy operation timeout middleware (120 seconds)
 * Use for PDF generation, AI operations, large exports
 */
export const heavyTimeout = timeout({
  timeoutMs: TIMEOUTS.HEAVY,
  message: "Request timed out after 2 minutes",
});

/**
 * Path-based timeout middleware factory
 * Applies different timeouts based on request path
 */
export function pathBasedTimeout(
  pathTimeouts: Record<string, number>,
  defaultTimeoutMs: number = TIMEOUTS.DEFAULT
) {
  return async (c: Context, next: Next) => {
    const path = c.req.path;

    // Find matching timeout for path
    let timeoutMs: number = defaultTimeoutMs;
    for (const [pattern, ms] of Object.entries(pathTimeouts)) {
      if (path.includes(pattern)) {
        timeoutMs = ms;
        break;
      }
    }

    // Apply timeout
    const timeoutMiddleware = timeout({
      timeoutMs,
      message: `Request timed out after ${timeoutMs / 1000} seconds`,
    });

    return timeoutMiddleware(c, next);
  };
}

/**
 * API v1 timeout configuration
 * Different timeouts for different endpoints
 */
export const apiV1Timeout = pathBasedTimeout(
  {
    "/ai/": TIMEOUTS.HEAVY, // AI operations: 2 minutes
    "/export": TIMEOUTS.HEAVY, // Exports: 2 minutes
    "/pdf": TIMEOUTS.HEAVY, // PDF generation: 2 minutes
    "/health": TIMEOUTS.QUICK, // Health checks: 10 seconds
  },
  TIMEOUTS.DEFAULT // Default: 30 seconds
);
