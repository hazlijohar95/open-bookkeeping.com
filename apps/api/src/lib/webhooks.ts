/**
 * Webhook Helper Module
 * Simple interface for triggering webhook events from services
 */

import { queueWebhookDispatch } from "./queue";
import type { WebhookEvent } from "@open-bookkeeping/db";

// Re-export types for convenience
export type { WebhookEvent } from "@open-bookkeeping/db";

/**
 * Trigger a webhook event for a user
 * This queues the event for async delivery to all subscribed endpoints
 *
 * @param userId - The user ID whose webhooks should be triggered
 * @param event - The event type (e.g., "invoice.created")
 * @param data - The event data payload (usually the affected resource)
 *
 * @example
 * // After creating an invoice
 * await triggerWebhook(userId, "invoice.created", {
 *   id: invoice.id,
 *   invoiceNumber: invoice.invoiceNumber,
 *   customerId: invoice.customerId,
 *   total: invoice.total,
 *   status: invoice.status,
 * });
 */
export async function triggerWebhook(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await queueWebhookDispatch({
      userId,
      event,
      data,
    });
  } catch (error) {
    // Log but don't throw - webhook failures shouldn't break main operations
    console.error(`[Webhooks] Failed to queue ${event} event:`, error);
  }
}

/**
 * Batch trigger multiple webhook events
 * Useful when multiple resources are affected in a single operation
 */
export async function triggerWebhooks(
  events: Array<{
    userId: string;
    event: WebhookEvent;
    data: Record<string, unknown>;
  }>
): Promise<void> {
  await Promise.all(
    events.map((e) => triggerWebhook(e.userId, e.event, e.data))
  );
}

// Predefined event helpers for common operations

/**
 * Invoice webhook events
 */
export const invoiceWebhooks = {
  created: (userId: string, invoice: Record<string, unknown>) =>
    triggerWebhook(userId, "invoice.created", invoice),

  updated: (userId: string, invoice: Record<string, unknown>) =>
    triggerWebhook(userId, "invoice.updated", invoice),

  deleted: (userId: string, invoice: Record<string, unknown>) =>
    triggerWebhook(userId, "invoice.deleted", invoice),

  paid: (userId: string, invoice: Record<string, unknown>) =>
    triggerWebhook(userId, "invoice.paid", invoice),

  overdue: (userId: string, invoice: Record<string, unknown>) =>
    triggerWebhook(userId, "invoice.overdue", invoice),

  sent: (userId: string, invoice: Record<string, unknown>) =>
    triggerWebhook(userId, "invoice.sent", invoice),
};

/**
 * Customer webhook events
 */
export const customerWebhooks = {
  created: (userId: string, customer: Record<string, unknown>) =>
    triggerWebhook(userId, "customer.created", customer),

  updated: (userId: string, customer: Record<string, unknown>) =>
    triggerWebhook(userId, "customer.updated", customer),

  deleted: (userId: string, customer: Record<string, unknown>) =>
    triggerWebhook(userId, "customer.deleted", customer),
};

/**
 * Vendor webhook events
 */
export const vendorWebhooks = {
  created: (userId: string, vendor: Record<string, unknown>) =>
    triggerWebhook(userId, "vendor.created", vendor),

  updated: (userId: string, vendor: Record<string, unknown>) =>
    triggerWebhook(userId, "vendor.updated", vendor),

  deleted: (userId: string, vendor: Record<string, unknown>) =>
    triggerWebhook(userId, "vendor.deleted", vendor),
};

/**
 * Quotation webhook events
 */
export const quotationWebhooks = {
  created: (userId: string, quotation: Record<string, unknown>) =>
    triggerWebhook(userId, "quotation.created", quotation),

  updated: (userId: string, quotation: Record<string, unknown>) =>
    triggerWebhook(userId, "quotation.updated", quotation),

  accepted: (userId: string, quotation: Record<string, unknown>) =>
    triggerWebhook(userId, "quotation.accepted", quotation),

  rejected: (userId: string, quotation: Record<string, unknown>) =>
    triggerWebhook(userId, "quotation.rejected", quotation),

  converted: (userId: string, quotation: Record<string, unknown>) =>
    triggerWebhook(userId, "quotation.converted", quotation),
};

/**
 * Bill webhook events
 */
export const billWebhooks = {
  created: (userId: string, bill: Record<string, unknown>) =>
    triggerWebhook(userId, "bill.created", bill),

  updated: (userId: string, bill: Record<string, unknown>) =>
    triggerWebhook(userId, "bill.updated", bill),

  paid: (userId: string, bill: Record<string, unknown>) =>
    triggerWebhook(userId, "bill.paid", bill),
};

/**
 * Payment webhook events
 */
export const paymentWebhooks = {
  received: (userId: string, payment: Record<string, unknown>) =>
    triggerWebhook(userId, "payment.received", payment),

  refunded: (userId: string, payment: Record<string, unknown>) =>
    triggerWebhook(userId, "payment.refunded", payment),
};

/**
 * E-Invoice (MyInvois) webhook events
 */
export const einvoiceWebhooks = {
  submitted: (userId: string, einvoice: Record<string, unknown>) =>
    triggerWebhook(userId, "einvoice.submitted", einvoice),

  validated: (userId: string, einvoice: Record<string, unknown>) =>
    triggerWebhook(userId, "einvoice.validated", einvoice),

  rejected: (userId: string, einvoice: Record<string, unknown>) =>
    triggerWebhook(userId, "einvoice.rejected", einvoice),

  cancelled: (userId: string, einvoice: Record<string, unknown>) =>
    triggerWebhook(userId, "einvoice.cancelled", einvoice),
};

/**
 * Credit/Debit note webhook events
 */
export const creditNoteWebhooks = {
  created: (userId: string, note: Record<string, unknown>) =>
    triggerWebhook(userId, "credit-note.created", note),

  applied: (userId: string, note: Record<string, unknown>) =>
    triggerWebhook(userId, "credit-note.applied", note),
};

export const debitNoteWebhooks = {
  created: (userId: string, note: Record<string, unknown>) =>
    triggerWebhook(userId, "debit-note.created", note),

  applied: (userId: string, note: Record<string, unknown>) =>
    triggerWebhook(userId, "debit-note.applied", note),
};
