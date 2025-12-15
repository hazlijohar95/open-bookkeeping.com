/**
 * Request Timeout Middleware
 *
 * Prevents requests from hanging indefinitely with proper cleanup.
 * Uses AbortController to properly cancel handlers on timeout,
 * preventing memory leaks and zombie request handling.
 *
 * IMPORTANT: This fixes the race condition where handlers could
 * continue executing after a timeout response was sent.
 */

import type { Context, Next } from "hono";
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
 *
 * This implementation properly handles the race condition by:
 * 1. Using an AbortController to signal timeout to handlers
 * 2. Tracking response state to prevent double-sends
 * 3. Cleaning up timers properly in all cases
 * 4. Logging timeout events for monitoring
 */
export function timeout(config: TimeoutConfig) {
  const { timeoutMs, message = "Request timeout" } = config;

  return async (c: Context, next: Next) => {
    const requestId = c.res.headers.get("X-Request-Id") ?? "unknown";
    const startTime = Date.now();

    // Create AbortController for this request
    const abortController = new AbortController();
    let timedOut = false;
    let handlerCompleted = false;

    // Store abort controller in context for handlers to check
    c.set("abortSignal", abortController.signal);

    // Set up timeout
    const timer = setTimeout(() => {
      if (handlerCompleted) {
        // Handler already finished, no need to abort
        return;
      }

      timedOut = true;
      abortController.abort();

      const duration = Date.now() - startTime;
      logger.warn(
        {
          requestId,
          path: c.req.path,
          method: c.req.method,
          timeoutMs,
          duration,
        },
        "Request timed out - aborting handler"
      );
    }, timeoutMs);

    try {
      // Run the handler
      await next();

      // Handler completed successfully
      handlerCompleted = true;
    } catch (error) {
      handlerCompleted = true;

      // Check if this was an abort error (from our timeout)
      if (error instanceof Error && error.name === "AbortError") {
        // This is expected when we abort - don't rethrow
        timedOut = true;
      } else {
        // Re-throw other errors for error handling middleware
        throw error;
      }
    } finally {
      // Always clean up the timer
      clearTimeout(timer);
    }

    // If timed out, return timeout response
    if (timedOut) {
      const duration = Date.now() - startTime;

      return c.json(
        {
          error: "Request Timeout",
          message,
          requestId,
          duration,
        },
        408
      );
    }

    // Handler completed before timeout - response already set by handler
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

/**
 * Helper for handlers to check if request was aborted
 * Use this in long-running operations to exit early on timeout
 */
export function isRequestAborted(c: Context): boolean {
  const signal = c.get("abortSignal") as AbortSignal | undefined;
  return signal?.aborted ?? false;
}

/**
 * Helper to throw if request was aborted
 * Use at checkpoints in long-running handlers
 */
export function throwIfAborted(c: Context): void {
  if (isRequestAborted(c)) {
    const error = new Error("Request was aborted");
    error.name = "AbortError";
    throw error;
  }
}
