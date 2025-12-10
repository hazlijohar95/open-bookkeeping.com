/**
 * Open Bookkeeping Webhook Utilities
 * Helpers for verifying webhook signatures and constructing events
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature, constructWebhookEvent } from '@open-bookkeeping/sdk/webhooks';
 *
 * // Express.js example
 * app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
 *   const signature = req.headers['x-webhook-signature'];
 *   const timestamp = req.headers['x-webhook-timestamp'];
 *
 *   try {
 *     const event = constructWebhookEvent(
 *       req.body,
 *       signature,
 *       timestamp,
 *       process.env.WEBHOOK_SECRET
 *     );
 *
 *     // Handle the event
 *     switch (event.event) {
 *       case 'invoice.created':
 *         handleInvoiceCreated(event.data);
 *         break;
 *     }
 *
 *     res.json({ received: true });
 *   } catch (err) {
 *     res.status(400).json({ error: err.message });
 *   }
 * });
 * ```
 */

import type { WebhookPayload, WebhookEventType } from "./types";

// Default tolerance for timestamp validation (5 minutes)
const DEFAULT_TOLERANCE_SECONDS = 300;

export interface WebhookSignatureError extends Error {
  name: "WebhookSignatureError";
}

/**
 * Create a WebhookSignatureError
 */
function createSignatureError(message: string): WebhookSignatureError {
  const error = new Error(message) as WebhookSignatureError;
  error.name = "WebhookSignatureError";
  return error;
}

/**
 * Compute HMAC-SHA256 signature
 * Works in both Node.js and browser environments
 */
async function computeHmacSha256(
  secret: string,
  payload: string
): Promise<string> {
  // Check if we're in Node.js environment
  if (typeof globalThis.crypto?.subtle === "undefined") {
    // Node.js environment - use crypto module
    const crypto = await import("crypto");
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  }

  // Browser/Edge environment - use Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await globalThis.crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Synchronous HMAC-SHA256 computation for Node.js
 * Use this when async isn't available (rare)
 */
function computeHmacSha256Sync(secret: string, payload: string): string {
  // This only works in Node.js
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("crypto");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify a webhook signature
 *
 * @param payload - The raw request body as a string
 * @param signature - The signature from X-Webhook-Signature header
 * @param timestamp - The timestamp from X-Webhook-Timestamp header
 * @param secret - Your webhook signing secret
 * @param toleranceSeconds - Maximum age of the webhook in seconds (default: 300)
 * @returns Promise<boolean> - True if signature is valid
 * @throws WebhookSignatureError if verification fails
 */
export async function verifyWebhookSignature(
  payload: string | Buffer | Uint8Array,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS
): Promise<boolean> {
  if (!payload) {
    throw createSignatureError("Payload is required");
  }

  if (!signature) {
    throw createSignatureError("Signature header is missing");
  }

  if (!timestamp) {
    throw createSignatureError("Timestamp header is missing");
  }

  if (!secret) {
    throw createSignatureError("Webhook secret is required");
  }

  // Convert payload to string if needed
  const payloadString =
    typeof payload === "string"
      ? payload
      : payload instanceof Buffer
        ? payload.toString("utf-8")
        : new TextDecoder().decode(payload);

  // Validate timestamp
  const webhookTimestamp = parseInt(timestamp, 10);
  if (isNaN(webhookTimestamp)) {
    throw createSignatureError("Invalid timestamp format");
  }

  const now = Math.floor(Date.now() / 1000);
  const age = now - webhookTimestamp;

  if (age > toleranceSeconds) {
    throw createSignatureError(
      `Webhook timestamp is too old. Received ${age} seconds ago, tolerance is ${toleranceSeconds} seconds`
    );
  }

  if (age < -toleranceSeconds) {
    throw createSignatureError(
      `Webhook timestamp is in the future. Clock skew detected`
    );
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = await computeHmacSha256(secret, signedPayload);

  // Parse signature header (format: v1=signature)
  const signatureParts = signature.split(",");
  let foundValid = false;

  for (const part of signatureParts) {
    const [version, sig] = part.trim().split("=");
    if (version === "v1" && sig) {
      if (secureCompare(sig, expectedSignature)) {
        foundValid = true;
        break;
      }
    }
  }

  if (!foundValid) {
    throw createSignatureError("Signature verification failed");
  }

  return true;
}

/**
 * Synchronous version of verifyWebhookSignature (Node.js only)
 */
export function verifyWebhookSignatureSync(
  payload: string | Buffer,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS
): boolean {
  if (!payload) {
    throw createSignatureError("Payload is required");
  }

  if (!signature) {
    throw createSignatureError("Signature header is missing");
  }

  if (!timestamp) {
    throw createSignatureError("Timestamp header is missing");
  }

  if (!secret) {
    throw createSignatureError("Webhook secret is required");
  }

  const payloadString =
    typeof payload === "string" ? payload : payload.toString("utf-8");

  // Validate timestamp
  const webhookTimestamp = parseInt(timestamp, 10);
  if (isNaN(webhookTimestamp)) {
    throw createSignatureError("Invalid timestamp format");
  }

  const now = Math.floor(Date.now() / 1000);
  const age = now - webhookTimestamp;

  if (age > toleranceSeconds) {
    throw createSignatureError(
      `Webhook timestamp is too old. Received ${age} seconds ago, tolerance is ${toleranceSeconds} seconds`
    );
  }

  if (age < -toleranceSeconds) {
    throw createSignatureError(`Webhook timestamp is in the future`);
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payloadString}`;
  const expectedSignature = computeHmacSha256Sync(secret, signedPayload);

  // Parse signature header
  const signatureParts = signature.split(",");
  let foundValid = false;

  for (const part of signatureParts) {
    const [version, sig] = part.trim().split("=");
    if (version === "v1" && sig) {
      if (secureCompare(sig, expectedSignature)) {
        foundValid = true;
        break;
      }
    }
  }

  if (!foundValid) {
    throw createSignatureError("Signature verification failed");
  }

  return true;
}

/**
 * Construct and verify a webhook event from a request
 *
 * @param payload - The raw request body
 * @param signature - The signature from X-Webhook-Signature header
 * @param timestamp - The timestamp from X-Webhook-Timestamp header
 * @param secret - Your webhook signing secret
 * @param toleranceSeconds - Maximum age of the webhook in seconds
 * @returns Promise<WebhookPayload> - The verified webhook event
 */
export async function constructWebhookEvent<T = Record<string, unknown>>(
  payload: string | Buffer | Uint8Array,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS
): Promise<WebhookPayload<T>> {
  // Verify signature first
  await verifyWebhookSignature(
    payload,
    signature,
    timestamp,
    secret,
    toleranceSeconds
  );

  // Parse the payload
  const payloadString =
    typeof payload === "string"
      ? payload
      : payload instanceof Buffer
        ? payload.toString("utf-8")
        : new TextDecoder().decode(payload);

  try {
    const event = JSON.parse(payloadString) as WebhookPayload<T>;

    // Validate event structure
    if (!event.id || !event.event || !event.data || !event.timestamp) {
      throw createSignatureError("Invalid webhook payload structure");
    }

    return event;
  } catch (error) {
    if ((error as Error).name === "WebhookSignatureError") {
      throw error;
    }
    throw createSignatureError("Failed to parse webhook payload as JSON");
  }
}

/**
 * Synchronous version of constructWebhookEvent (Node.js only)
 */
export function constructWebhookEventSync<T = Record<string, unknown>>(
  payload: string | Buffer,
  signature: string,
  timestamp: string,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS
): WebhookPayload<T> {
  // Verify signature first
  verifyWebhookSignatureSync(
    payload,
    signature,
    timestamp,
    secret,
    toleranceSeconds
  );

  // Parse the payload
  const payloadString =
    typeof payload === "string" ? payload : payload.toString("utf-8");

  try {
    const event = JSON.parse(payloadString) as WebhookPayload<T>;

    if (!event.id || !event.event || !event.data || !event.timestamp) {
      throw createSignatureError("Invalid webhook payload structure");
    }

    return event;
  } catch (error) {
    if ((error as Error).name === "WebhookSignatureError") {
      throw error;
    }
    throw createSignatureError("Failed to parse webhook payload as JSON");
  }
}

/**
 * Type guard to check if an event is a specific type
 */
export function isEventType<T extends WebhookEventType>(
  event: WebhookPayload,
  type: T
): event is WebhookPayload & { event: T } {
  return event.event === type;
}

/**
 * Helper type for webhook event handlers
 */
export type WebhookEventHandler<T = unknown> = (
  event: WebhookPayload<T>
) => void | Promise<void>;

/**
 * Create a webhook event router
 *
 * @example
 * ```typescript
 * const router = createWebhookRouter({
 *   'invoice.created': async (event) => {
 *     console.log('Invoice created:', event.data.id);
 *   },
 *   'invoice.paid': async (event) => {
 *     console.log('Invoice paid:', event.data.id);
 *   },
 * });
 *
 * // In your webhook handler
 * const event = await constructWebhookEvent(payload, sig, ts, secret);
 * await router(event);
 * ```
 */
export function createWebhookRouter(
  handlers: Partial<Record<WebhookEventType, WebhookEventHandler>>
): (event: WebhookPayload) => Promise<void> {
  return async (event: WebhookPayload) => {
    const handler = handlers[event.event];
    if (handler) {
      await handler(event);
    }
  };
}

// Re-export types for convenience
export type { WebhookPayload, WebhookEventType } from "./types";
