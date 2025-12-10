/**
 * Webhook Dispatch Service
 * Handles webhook event dispatching, signing, and delivery
 */

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  webhookRepository,
  type WebhookEvent,
  type Webhook,
  type WebhookDelivery,
} from "@open-bookkeeping/db";
import {
  canExecute,
  recordSuccess,
  recordFailure,
  getCircuitState,
  WEBHOOK_CIRCUIT_CONFIG,
  type CircuitState,
} from "../lib/circuit-breaker";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("webhook-service");

// ============================================
// SSRF PROTECTION
// ============================================

/**
 * Block list for internal/private IP ranges (SSRF protection)
 * Prevents webhooks from targeting internal infrastructure
 */
const BLOCKED_IP_PATTERNS = [
  // Loopback addresses
  /^127\./,
  /^::1$/,
  /^localhost$/i,
  // Private IPv4 ranges (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  // Link-local addresses
  /^169\.254\./,
  /^fe80:/i,
  // AWS metadata service
  /^169\.254\.169\.254$/,
  // Cloud metadata endpoints
  /^metadata\./i,
  /^metadata$/i,
  // Internal domains
  /\.internal$/i,
  /\.local$/i,
  /\.localhost$/i,
];

/**
 * Block list for disallowed URL schemes
 */
const ALLOWED_SCHEMES = ["https:", "http:"];

/**
 * Validate webhook URL is safe (not targeting internal resources)
 * @throws Error if URL is unsafe
 */
export function validateWebhookUrl(urlString: string): { valid: true } | { valid: false; reason: string } {
  try {
    const url = new URL(urlString);

    // Check scheme
    if (!ALLOWED_SCHEMES.includes(url.protocol)) {
      return { valid: false, reason: `Invalid URL scheme: ${url.protocol}. Only HTTP(S) allowed.` };
    }

    // Check hostname against blocked patterns
    const hostname = url.hostname.toLowerCase();
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: "Webhook URLs cannot target internal or private addresses" };
      }
    }

    // Block URLs with credentials
    if (url.username || url.password) {
      return { valid: false, reason: "Webhook URLs cannot contain credentials" };
    }

    // Block non-standard ports commonly used for internal services
    const port = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80);
    const blockedPorts = [22, 23, 25, 3306, 5432, 6379, 27017, 11211]; // SSH, Telnet, SMTP, MySQL, PostgreSQL, Redis, MongoDB, Memcached
    if (blockedPorts.includes(port)) {
      return { valid: false, reason: `Port ${port} is not allowed for webhooks` };
    }

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return { valid: false, reason: "Webhook URLs must use HTTPS in production" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }
}

// Webhook payload structure (Stripe-like format)
export interface WebhookPayload {
  id: string; // evt_xxx unique event ID
  type: WebhookEvent;
  created: string; // ISO timestamp
  data: {
    object: Record<string, unknown>;
  };
}

// Delivery result
export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseTimeMs: number;
  error?: string;
}

// Retry schedule: 1min, 5min, 30min, 2hr, 24hr (with jitter)
const RETRY_DELAYS_MS = [
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  24 * 60 * 60 * 1000, // 24 hours
];

/**
 * Add jitter to delay to prevent thundering herd
 * Adds +/- 10% randomization
 */
function addJitter(delayMs: number): number {
  const jitterFactor = 0.1; // 10% jitter
  const jitter = delayMs * jitterFactor * (Math.random() * 2 - 1);
  return Math.round(delayMs + jitter);
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Verify webhook signature (for clients to use)
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = generateSignature(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Create a webhook event payload
 */
export function createEventPayload(
  event: WebhookEvent,
  data: Record<string, unknown>
): WebhookPayload {
  return {
    id: `evt_${uuidv4().replace(/-/g, "")}`,
    type: event,
    created: new Date().toISOString(),
    data: {
      object: data,
    },
  };
}

/**
 * Deliver a webhook to an endpoint
 */
export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string,
  timeoutMs = 30000
): Promise<DeliveryResult> {
  const startTime = Date.now();

  // SSRF protection: Validate URL before making request
  const urlValidation = validateWebhookUrl(url);
  if (!urlValidation.valid) {
    return {
      success: false,
      responseTimeMs: Date.now() - startTime,
      error: `URL validation failed: ${urlValidation.reason}`,
    };
  }

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Id": payload.id,
        "X-Webhook-Timestamp": payload.created,
        "User-Agent": "OpenBookkeeping-Webhooks/1.0",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTimeMs = Date.now() - startTime;
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
      // Truncate long responses
      if (responseBody.length > 2000) {
        responseBody = responseBody.substring(0, 2000) + "... (truncated)";
      }
    } catch {
      responseBody = undefined;
    }

    // Consider 2xx status codes as success
    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      statusCode: response.status,
      responseBody,
      responseTimeMs,
      error: success ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      responseTimeMs,
      error:
        errorMessage === "This operation was aborted"
          ? `Timeout after ${timeoutMs}ms`
          : errorMessage,
    };
  }
}

/**
 * Calculate next retry time based on attempt count
 * Includes jitter to prevent thundering herd problem
 */
export function calculateNextRetry(attempts: number): Date | null {
  if (attempts >= RETRY_DELAYS_MS.length) {
    return null; // No more retries
  }

  const baseDelay = RETRY_DELAYS_MS[attempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const delayWithJitter = addJitter(baseDelay!);
  return new Date(Date.now() + delayWithJitter);
}

/**
 * Dispatch a webhook event to all subscribed endpoints
 * This is the main entry point for triggering webhooks
 */
export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<{ queued: number; webhookIds: string[] }> {
  // Find all webhooks subscribed to this event
  const webhooks = await webhookRepository.findByEvent(userId, event);

  if (webhooks.length === 0) {
    return { queued: 0, webhookIds: [] };
  }

  // Create event payload (shared across all deliveries)
  const payload = createEventPayload(event, data);

  // Create delivery records for each webhook
  const webhookIds: string[] = [];

  for (const webhook of webhooks) {
    // Create delivery record
    await webhookRepository.createDelivery({
      webhookId: webhook.id,
      event,
      eventId: payload.id,
      payload: payload as unknown as Record<string, unknown>,
    });

    webhookIds.push(webhook.id);
  }

  return { queued: webhooks.length, webhookIds };
}

/**
 * Process a webhook delivery (called by worker)
 * Uses circuit breaker to prevent repeated calls to failing endpoints
 */
export async function processDelivery(
  delivery: WebhookDelivery & { webhook: Webhook }
): Promise<void> {
  const { webhook } = delivery;
  const payload = delivery.payload as unknown as WebhookPayload;

  // Circuit breaker identifier: use webhook ID (per-endpoint protection)
  const circuitId = `webhook:${webhook.id}`;

  // Check circuit breaker state
  const circuitCheck = canExecute(circuitId, WEBHOOK_CIRCUIT_CONFIG);

  if (!circuitCheck.allowed) {
    // Circuit is open - skip delivery and schedule for later
    logger.warn(
      { webhookId: webhook.id, deliveryId: delivery.id, state: circuitCheck.state },
      "Circuit breaker open, skipping webhook delivery"
    );

    // Calculate when circuit might recover
    const nextRetry = new Date(Date.now() + WEBHOOK_CIRCUIT_CONFIG.resetTimeoutMs);

    await webhookRepository.updateDeliveryStatus(delivery.id, {
      status: "retrying",
      errorMessage: `Circuit breaker open: ${circuitCheck.reason}`,
      nextRetryAt: nextRetry,
    });
    return;
  }

  // Attempt delivery
  const result = await deliverWebhook(webhook.url, payload, webhook.secret);

  if (result.success) {
    // Record success with circuit breaker
    recordSuccess(circuitId, WEBHOOK_CIRCUIT_CONFIG);

    // Mark as delivered
    await webhookRepository.updateDeliveryStatus(delivery.id, {
      status: "success",
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      responseTimeMs: result.responseTimeMs,
    });
  } else {
    // Record failure with circuit breaker
    recordFailure(circuitId, WEBHOOK_CIRCUIT_CONFIG);

    // Calculate next retry
    const nextRetry = calculateNextRetry(delivery.attempts);

    if (nextRetry) {
      // Schedule retry
      await webhookRepository.updateDeliveryStatus(delivery.id, {
        status: "retrying",
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.error,
        nextRetryAt: nextRetry,
      });
    } else {
      // Max retries reached, mark as failed
      await webhookRepository.markDeliveryFailed(
        delivery.id,
        result.error ?? "Max retries exceeded"
      );
    }
  }
}

/**
 * Get circuit breaker status for a webhook endpoint
 * Useful for monitoring and debugging
 */
export function getWebhookCircuitStatus(webhookId: string): {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
} {
  const circuitId = `webhook:${webhookId}`;
  const state = getCircuitState(circuitId);
  return {
    state: state.state,
    failures: state.failures,
    lastFailureTime: state.lastFailureTime,
  };
}

/**
 * Send a test webhook to verify endpoint configuration
 */
export async function sendTestWebhook(
  webhook: Webhook
): Promise<DeliveryResult> {
  const testPayload = createEventPayload("invoice.created", {
    id: "test_invoice_123",
    invoiceNumber: "TEST-001",
    status: "draft",
    total: "100.00",
    currency: "MYR",
    message: "This is a test webhook delivery",
    timestamp: new Date().toISOString(),
  });

  return deliverWebhook(webhook.url, testPayload, webhook.secret);
}

// Export types
export type { WebhookEvent, Webhook, WebhookDelivery };
