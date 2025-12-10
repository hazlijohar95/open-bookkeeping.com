/**
 * Webhook Integration Service
 * Provides easy-to-use functions for dispatching webhook events from business services
 *
 * Usage:
 * - Import `webhookDispatcher` into your service
 * - Call the appropriate method (e.g., `webhookDispatcher.invoiceCreated(userId, invoice)`)
 * - Events are dispatched asynchronously (non-blocking)
 */

import { dispatchWebhookEvent, type WebhookEvent } from "./webhook.service";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("webhook-integration");

/**
 * Safely dispatch a webhook event (non-blocking, catches errors)
 */
async function safeDispatch(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const result = await dispatchWebhookEvent(userId, event, data);
    if (result.queued > 0) {
      logger.info({ event, queued: result.queued, userId }, "Webhook event dispatched");
    }
  } catch (error) {
    // Log but don't throw - webhooks should never block business logic
    logger.error({ error, event, userId }, "Failed to dispatch webhook event");
  }
}

/**
 * Fire-and-forget webhook dispatch (returns immediately)
 */
function fireAndForget(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): void {
  // Use setImmediate to ensure it doesn't block the current request
  setImmediate(() => {
    safeDispatch(userId, event, data).catch(() => {
      // Already logged in safeDispatch
    });
  });
}

// ============================================
// Invoice Events
// ============================================

interface InvoiceWebhookData {
  id: string;
  serialNumber?: string;
  status: string;
  total?: number;
  currency?: string;
  customerId?: string;
  customerName?: string;
  createdAt?: Date | string;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
}

export function dispatchInvoiceCreated(userId: string, invoice: InvoiceWebhookData): void {
  fireAndForget(userId, "invoice.created", {
    id: invoice.id,
    invoiceNumber: invoice.serialNumber,
    status: invoice.status,
    total: invoice.total,
    currency: invoice.currency,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
  });
}

export function dispatchInvoiceUpdated(userId: string, invoice: InvoiceWebhookData): void {
  fireAndForget(userId, "invoice.updated", {
    id: invoice.id,
    invoiceNumber: invoice.serialNumber,
    status: invoice.status,
    total: invoice.total,
    currency: invoice.currency,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
  });
}

export function dispatchInvoicePaid(userId: string, invoice: InvoiceWebhookData): void {
  fireAndForget(userId, "invoice.paid", {
    id: invoice.id,
    invoiceNumber: invoice.serialNumber,
    total: invoice.total,
    currency: invoice.currency,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    paidAt: invoice.paidAt || new Date().toISOString(),
  });
}

export function dispatchInvoiceDeleted(userId: string, invoiceId: string, serialNumber?: string): void {
  fireAndForget(userId, "invoice.deleted", {
    id: invoiceId,
    invoiceNumber: serialNumber,
    deletedAt: new Date().toISOString(),
  });
}

export function dispatchInvoiceSent(userId: string, invoice: InvoiceWebhookData): void {
  fireAndForget(userId, "invoice.sent", {
    id: invoice.id,
    invoiceNumber: invoice.serialNumber,
    total: invoice.total,
    currency: invoice.currency,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    sentAt: new Date().toISOString(),
  });
}

// ============================================
// Bill Events
// ============================================

interface BillWebhookData {
  id: string;
  billNumber: string;
  status: string;
  total?: number | string;
  currency?: string;
  vendorId?: string | null;
  vendorName?: string;
  createdAt?: Date | string;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
}

export function dispatchBillCreated(userId: string, bill: BillWebhookData): void {
  fireAndForget(userId, "bill.created", {
    id: bill.id,
    billNumber: bill.billNumber,
    status: bill.status,
    total: bill.total,
    currency: bill.currency,
    vendorId: bill.vendorId,
    vendorName: bill.vendorName,
    createdAt: bill.createdAt,
    dueDate: bill.dueDate,
  });
}

export function dispatchBillUpdated(userId: string, bill: BillWebhookData): void {
  fireAndForget(userId, "bill.updated", {
    id: bill.id,
    billNumber: bill.billNumber,
    status: bill.status,
    total: bill.total,
    currency: bill.currency,
    vendorId: bill.vendorId,
    vendorName: bill.vendorName,
  });
}

export function dispatchBillPaid(userId: string, bill: BillWebhookData): void {
  fireAndForget(userId, "bill.paid", {
    id: bill.id,
    billNumber: bill.billNumber,
    total: bill.total,
    currency: bill.currency,
    vendorId: bill.vendorId,
    vendorName: bill.vendorName,
    paidAt: bill.paidAt || new Date().toISOString(),
  });
}

// ============================================
// Customer Events
// ============================================

interface CustomerWebhookData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

export function dispatchCustomerCreated(userId: string, customer: CustomerWebhookData): void {
  fireAndForget(userId, "customer.created", {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    createdAt: new Date().toISOString(),
  });
}

export function dispatchCustomerUpdated(userId: string, customer: CustomerWebhookData): void {
  fireAndForget(userId, "customer.updated", {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    company: customer.company,
    updatedAt: new Date().toISOString(),
  });
}

export function dispatchCustomerDeleted(userId: string, customerId: string): void {
  fireAndForget(userId, "customer.deleted", {
    id: customerId,
    deletedAt: new Date().toISOString(),
  });
}

// ============================================
// Vendor Events
// ============================================

interface VendorWebhookData {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

export function dispatchVendorCreated(userId: string, vendor: VendorWebhookData): void {
  fireAndForget(userId, "vendor.created", {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,
    company: vendor.company,
    createdAt: new Date().toISOString(),
  });
}

export function dispatchVendorUpdated(userId: string, vendor: VendorWebhookData): void {
  fireAndForget(userId, "vendor.updated", {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,
    company: vendor.company,
    updatedAt: new Date().toISOString(),
  });
}

export function dispatchVendorDeleted(userId: string, vendorId: string): void {
  fireAndForget(userId, "vendor.deleted", {
    id: vendorId,
    deletedAt: new Date().toISOString(),
  });
}

// ============================================
// Quotation Events
// ============================================

interface QuotationWebhookData {
  id: string;
  quotationNumber?: string;
  status: string;
  total?: number;
  currency?: string;
  customerId?: string;
  customerName?: string;
  validUntil?: Date | string | null;
  convertedInvoiceId?: string;
}

export function dispatchQuotationCreated(userId: string, quotation: QuotationWebhookData): void {
  fireAndForget(userId, "quotation.created", {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    status: quotation.status,
    total: quotation.total,
    currency: quotation.currency,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    validUntil: quotation.validUntil,
    createdAt: new Date().toISOString(),
  });
}

export function dispatchQuotationUpdated(userId: string, quotation: QuotationWebhookData): void {
  fireAndForget(userId, "quotation.updated", {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    status: quotation.status,
    total: quotation.total,
    currency: quotation.currency,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    validUntil: quotation.validUntil,
    updatedAt: new Date().toISOString(),
  });
}

export function dispatchQuotationAccepted(userId: string, quotation: QuotationWebhookData): void {
  fireAndForget(userId, "quotation.accepted", {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    total: quotation.total,
    currency: quotation.currency,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    acceptedAt: new Date().toISOString(),
  });
}

export function dispatchQuotationRejected(userId: string, quotation: QuotationWebhookData): void {
  fireAndForget(userId, "quotation.rejected", {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    total: quotation.total,
    currency: quotation.currency,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    rejectedAt: new Date().toISOString(),
  });
}

export function dispatchQuotationConverted(userId: string, quotation: QuotationWebhookData): void {
  fireAndForget(userId, "quotation.converted", {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    total: quotation.total,
    currency: quotation.currency,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    convertedInvoiceId: quotation.convertedInvoiceId,
    convertedAt: new Date().toISOString(),
  });
}

// ============================================
// Credit/Debit Note Events
// ============================================

interface NoteWebhookData {
  id: string;
  serialNumber?: string;
  total?: number;
  currency?: string;
  customerId?: string;
  customerName?: string;
  reason?: string;
  originalInvoiceId?: string;
}

export function dispatchCreditNoteCreated(userId: string, note: NoteWebhookData): void {
  fireAndForget(userId, "credit-note.created", {
    id: note.id,
    serialNumber: note.serialNumber,
    total: note.total,
    currency: note.currency,
    customerId: note.customerId,
    customerName: note.customerName,
    reason: note.reason,
    originalInvoiceId: note.originalInvoiceId,
    createdAt: new Date().toISOString(),
  });
}

export function dispatchCreditNoteApplied(userId: string, note: NoteWebhookData): void {
  fireAndForget(userId, "credit-note.applied", {
    id: note.id,
    serialNumber: note.serialNumber,
    total: note.total,
    currency: note.currency,
    customerId: note.customerId,
    originalInvoiceId: note.originalInvoiceId,
    appliedAt: new Date().toISOString(),
  });
}

export function dispatchDebitNoteCreated(userId: string, note: NoteWebhookData): void {
  fireAndForget(userId, "debit-note.created", {
    id: note.id,
    serialNumber: note.serialNumber,
    total: note.total,
    currency: note.currency,
    customerId: note.customerId,
    customerName: note.customerName,
    reason: note.reason,
    originalInvoiceId: note.originalInvoiceId,
    createdAt: new Date().toISOString(),
  });
}

export function dispatchDebitNoteApplied(userId: string, note: NoteWebhookData): void {
  fireAndForget(userId, "debit-note.applied", {
    id: note.id,
    serialNumber: note.serialNumber,
    total: note.total,
    currency: note.currency,
    customerId: note.customerId,
    originalInvoiceId: note.originalInvoiceId,
    appliedAt: new Date().toISOString(),
  });
}

// ============================================
// Payment Events
// ============================================

interface PaymentWebhookData {
  id: string;
  amount: number;
  currency?: string;
  sourceType: "invoice" | "bill";
  sourceId: string;
  sourceNumber?: string;
  partyId?: string;
  partyName?: string;
}

export function dispatchPaymentReceived(userId: string, payment: PaymentWebhookData): void {
  fireAndForget(userId, "payment.received", {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    invoiceId: payment.sourceId,
    invoiceNumber: payment.sourceNumber,
    customerId: payment.partyId,
    customerName: payment.partyName,
    receivedAt: new Date().toISOString(),
  });
}

export function dispatchPaymentRefunded(userId: string, payment: PaymentWebhookData): void {
  fireAndForget(userId, "payment.refunded", {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    invoiceId: payment.sourceId,
    invoiceNumber: payment.sourceNumber,
    customerId: payment.partyId,
    customerName: payment.partyName,
    refundedAt: new Date().toISOString(),
  });
}

// Export all dispatchers as a single object for convenience
export const webhookDispatcher = {
  // Invoice
  invoiceCreated: dispatchInvoiceCreated,
  invoiceUpdated: dispatchInvoiceUpdated,
  invoicePaid: dispatchInvoicePaid,
  invoiceDeleted: dispatchInvoiceDeleted,
  invoiceSent: dispatchInvoiceSent,
  // Bill
  billCreated: dispatchBillCreated,
  billUpdated: dispatchBillUpdated,
  billPaid: dispatchBillPaid,
  // Customer
  customerCreated: dispatchCustomerCreated,
  customerUpdated: dispatchCustomerUpdated,
  customerDeleted: dispatchCustomerDeleted,
  // Vendor
  vendorCreated: dispatchVendorCreated,
  vendorUpdated: dispatchVendorUpdated,
  vendorDeleted: dispatchVendorDeleted,
  // Quotation
  quotationCreated: dispatchQuotationCreated,
  quotationUpdated: dispatchQuotationUpdated,
  quotationAccepted: dispatchQuotationAccepted,
  quotationRejected: dispatchQuotationRejected,
  quotationConverted: dispatchQuotationConverted,
  // Notes
  creditNoteCreated: dispatchCreditNoteCreated,
  creditNoteApplied: dispatchCreditNoteApplied,
  debitNoteCreated: dispatchDebitNoteCreated,
  debitNoteApplied: dispatchDebitNoteApplied,
  // Payments
  paymentReceived: dispatchPaymentReceived,
  paymentRefunded: dispatchPaymentRefunded,
};
