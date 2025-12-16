/**
 * Invoice Business Service
 *
 * Centralized business logic for invoice operations.
 * Both REST routes and tRPC services should use this layer.
 *
 * Responsibilities:
 * - Core CRUD operations via repository
 * - Webhook dispatching (non-blocking)
 * - Journal entry creation (non-blocking)
 * - Aggregation updates (non-blocking with retry)
 * - Business rule validation
 * - Structured logging
 */

import {
  invoiceV2Repository,
  isValidStatusTransition,
  getValidNextStatuses,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { aggregationService } from "../aggregation.service";
import { journalEntryIntegration } from "../journalEntry.integration";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("invoice-business");

// ============================================
// Types
// ============================================

export interface CreateInvoiceInput {
  customerId?: string | null;
  vendorId?: string | null;
  status?: "draft" | "open" | "paid" | "void" | "uncollectible" | "refunded";
  prefix: string;
  serialNumber: string;
  currency: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  paymentTerms?: string | null;
  theme?: {
    baseColor: string;
    mode: "dark" | "light";
    template?: "default" | "cynco" | "classic" | "zen" | "executive";
  } | null;
  companyDetails: {
    name: string;
    address: string;
    logo?: string | null;
    signature?: string | null;
    metadata?: Array<{ label: string; value: string }>;
  };
  clientDetails: {
    name: string;
    address: string;
    taxId?: string;
    metadata?: Array<{ label: string; value: string }>;
  };
  billingDetails?: Array<{
    label: string;
    type: "fixed" | "percentage";
    value: string | number;
    isSstTax?: boolean;
    sstTaxType?: "sales_tax" | "service_tax";
    sstRateCode?: string;
  }>;
  metadata?: {
    notes?: string;
    terms?: string;
    paymentInformation?: Array<{ label: string; value: string }>;
  };
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    unit?: string;
    sku?: string;
    taxRate?: number;
    discount?: number;
  }>;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  currency?: string;
  method?: string;
  reference?: string;
  paidAt?: Date;
  notes?: string;
}

export interface InvoiceBusinessContext {
  userId: string;
  allowedSavingData?: boolean;
}

type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "void"
  | "uncollectible"
  | "refunded";

// ============================================
// Helper Functions
// ============================================

/**
 * Retry wrapper with exponential backoff for aggregation updates.
 * Aggregations are non-blocking but should eventually succeed.
 */
async function retryAggregationUpdate(
  fn: () => Promise<void>,
  context: { userId: string; action: string },
  maxRetries = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      if (attempt > 1) {
        logger.info(
          { ...context, attempt },
          "Aggregation update succeeded after retry"
        );
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);

      if (attempt < maxRetries) {
        logger.warn(
          { ...context, attempt, nextRetryMs: delay },
          "Aggregation update failed, retrying"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    { ...context, error: lastError?.message, attempts: maxRetries },
    "Aggregation update failed after all retries"
  );
}

/**
 * Create journal entry for invoice in background (non-blocking)
 */
function createInvoiceJournalEntryAsync(
  userId: string,
  invoiceId: string,
  invoiceData: {
    serialNumber: string;
    date: Date;
    currency: string;
    items: CreateInvoiceInput["items"];
    billingDetails?: CreateInvoiceInput["billingDetails"];
    clientDetails: CreateInvoiceInput["clientDetails"];
  }
): void {
  journalEntryIntegration
    .hasChartOfAccounts(userId)
    .then((hasAccounts) => {
      if (hasAccounts) {
        journalEntryIntegration
          .createInvoiceJournalEntry(userId, {
            id: invoiceId,
            serialNumber: invoiceData.serialNumber,
            date: invoiceData.date,
            currency: invoiceData.currency,
            items: invoiceData.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
            billingDetails: invoiceData.billingDetails?.map((bd) => ({
              label: bd.label,
              type: bd.type,
              value:
                typeof bd.value === "string" ? parseFloat(bd.value) : bd.value,
              isSstTax: bd.isSstTax,
              sstTaxType: bd.sstTaxType,
            })),
            clientDetails: {
              name: invoiceData.clientDetails.name,
            },
          })
          .then((result) => {
            if (result.success) {
              logger.info(
                { userId, invoiceId, entryId: result.entryId },
                "Journal entry created for invoice"
              );
            } else {
              logger.warn(
                { userId, invoiceId, error: result.error },
                "Failed to create journal entry for invoice"
              );
            }
          })
          .catch((err) => {
            logger.warn(
              { userId, invoiceId, error: err },
              "Error creating journal entry for invoice"
            );
          });
      }
    })
    .catch(() => {
      // Silently ignore - chart of accounts not initialized
    });
}

/**
 * Create payment journal entry in background (non-blocking)
 */
function createPaymentJournalEntryAsync(
  userId: string,
  invoiceId: string,
  invoice: {
    prefix: string;
    serialNumber: string;
    total: string;
    clientDetails: unknown;
  }
): void {
  journalEntryIntegration
    .hasChartOfAccounts(userId)
    .then(async (hasAccounts) => {
      if (hasAccounts) {
        const paymentAmount = parseFloat(invoice.total);
        const clientName =
          (invoice.clientDetails as { name?: string })?.name ?? "Customer";

        journalEntryIntegration
          .createPaymentJournalEntry(userId, {
            sourceType: "invoice",
            sourceId: invoiceId,
            sourceNumber: `${invoice.prefix}${invoice.serialNumber}`,
            amount: paymentAmount,
            date: new Date(),
            partyName: clientName,
          })
          .then((result) => {
            if (result.success) {
              logger.info(
                { userId, invoiceId, entryId: result.entryId },
                "Payment journal entry created"
              );
            } else {
              logger.warn(
                { userId, invoiceId, error: result.error },
                "Failed to create payment journal entry"
              );
            }
          })
          .catch((err) => {
            logger.warn(
              { userId, invoiceId, error: err },
              "Error creating payment journal entry"
            );
          });
      }
    })
    .catch(() => {
      // Silently ignore - chart of accounts not initialized
    });
}

// ============================================
// Business Service
// ============================================

export const invoiceBusiness = {
  /**
   * List invoices (lightweight for table views)
   */
  async list(
    ctx: InvoiceBusinessContext,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    const invoices = await invoiceV2Repository.findManyLight(ctx.userId, {
      limit,
      offset,
    });

    logger.debug(
      { userId: ctx.userId, count: invoices.length },
      "Listed invoices"
    );

    return invoices;
  },

  /**
   * Get a single invoice by ID
   */
  async getById(ctx: InvoiceBusinessContext, id: string) {
    const invoice = await invoiceV2Repository.findById(id, ctx.userId);

    if (!invoice) {
      logger.debug({ userId: ctx.userId, invoiceId: id }, "Invoice not found");
      return null;
    }

    return invoice;
  },

  /**
   * Get invoices by customer
   */
  async getByCustomer(
    ctx: InvoiceBusinessContext,
    customerId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    return invoiceV2Repository.findByCustomer(customerId, ctx.userId, {
      limit,
      offset,
    });
  },

  /**
   * Get unpaid invoices by customer
   */
  async getUnpaidByCustomer(ctx: InvoiceBusinessContext, customerId: string) {
    return invoiceV2Repository.getUnpaidByCustomer(customerId, ctx.userId);
  },

  /**
   * Get next serial number for a prefix
   */
  async getNextSerialNumber(ctx: InvoiceBusinessContext, prefix: string) {
    return invoiceV2Repository.getNextSerialNumber(ctx.userId, prefix);
  },

  /**
   * Get valid status transitions for an invoice
   */
  async getStatusTransitions(ctx: InvoiceBusinessContext, id: string) {
    const invoice = await invoiceV2Repository.findById(id, ctx.userId);

    if (!invoice) {
      return null;
    }

    return {
      currentStatus: invoice.status,
      validTransitions: getValidNextStatuses(invoice.status),
    };
  },

  /**
   * Create a new invoice
   *
   * Side effects (non-blocking):
   * - Dispatches invoice.created webhook
   * - Creates journal entry if status is "open" and chart of accounts exists
   */
  async create(ctx: InvoiceBusinessContext, input: CreateInvoiceInput) {
    // Check if user is allowed to save data
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    // Normalize billing details (ensure value is string)
    const billingDetails = input.billingDetails?.map((bd) => ({
      ...bd,
      value: String(bd.value),
    }));

    // Create invoice
    const result = await invoiceV2Repository.create({
      userId: ctx.userId,
      customerId: input.customerId ?? undefined,
      vendorId: input.vendorId ?? undefined,
      status: input.status ?? "draft",
      prefix: input.prefix,
      serialNumber: input.serialNumber,
      currency: input.currency,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate ?? undefined,
      paymentTerms: input.paymentTerms ?? undefined,
      theme: input.theme ?? undefined,
      companyDetails: input.companyDetails,
      clientDetails: input.clientDetails,
      billingDetails,
      metadata: input.metadata,
      items: input.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unit: item.unit,
        sku: item.sku,
        taxRate: item.taxRate,
        discount: item.discount,
      })),
    });

    logger.info(
      { userId: ctx.userId, invoiceId: result.invoiceId },
      "Invoice created"
    );

    // Dispatch webhook (non-blocking)
    webhookDispatcher.invoiceCreated(ctx.userId, {
      id: result.invoiceId,
      serialNumber: `${input.prefix}${input.serialNumber}`,
      status: input.status ?? "draft",
      currency: input.currency,
      customerId: input.customerId ?? undefined,
      dueDate: input.dueDate,
      createdAt: new Date(),
    });

    // Create journal entry when invoice is issued (status = open)
    if (input.status === "open") {
      createInvoiceJournalEntryAsync(ctx.userId, result.invoiceId, {
        serialNumber: input.serialNumber,
        date: input.invoiceDate,
        currency: input.currency,
        items: input.items,
        billingDetails: input.billingDetails,
        clientDetails: input.clientDetails,
      });
    }

    return result;
  },

  /**
   * Update invoice status
   *
   * Side effects (non-blocking):
   * - Dispatches invoice.updated webhook
   * - Dispatches invoice.paid webhook if status becomes "paid"
   * - Updates aggregation totals
   * - Creates payment journal entry if status becomes "paid"
   */
  async updateStatus(
    ctx: InvoiceBusinessContext,
    id: string,
    newStatus: InvoiceStatus
  ) {
    // Get current invoice to validate transition
    const invoice = await invoiceV2Repository.findById(id, ctx.userId);

    if (!invoice) {
      return null;
    }

    // Validate status transition
    if (!isValidStatusTransition(invoice.status, newStatus)) {
      const validStatuses = getValidNextStatuses(invoice.status);
      throw new Error(
        `Cannot transition from '${invoice.status}' to '${newStatus}'. ` +
          `Valid transitions: ${validStatuses.length > 0 ? validStatuses.join(", ") : "none (terminal state)"}`
      );
    }

    // Update status
    const updated = await invoiceV2Repository.updateStatus(
      id,
      ctx.userId,
      newStatus
    );

    if (!updated) {
      return null;
    }

    logger.info(
      { userId: ctx.userId, invoiceId: id, status: newStatus },
      "Invoice status updated"
    );

    // Dispatch webhook (non-blocking)
    webhookDispatcher.invoiceUpdated(ctx.userId, {
      id,
      status: newStatus,
    });

    // Dispatch paid webhook if status is "paid"
    if (newStatus === "paid") {
      webhookDispatcher.invoicePaid(ctx.userId, {
        id,
        status: "paid",
        paidAt: new Date(),
      });
    }

    // Update aggregations in background with retry
    if (updated.createdAt) {
      const invoiceDate = new Date(updated.createdAt);
      retryAggregationUpdate(
        () =>
          aggregationService.updateInvoiceMonthlyTotals(
            ctx.userId,
            invoiceDate.getFullYear(),
            invoiceDate.getMonth() + 1
          ),
        { userId: ctx.userId, action: "updateInvoiceMonthlyTotals" }
      );
    }

    // Create payment journal entry when marked as paid
    if (newStatus === "paid") {
      createPaymentJournalEntryAsync(ctx.userId, id, invoice);
    }

    return { success: true, invoice: updated };
  },

  /**
   * Record a payment for an invoice
   *
   * Side effects (non-blocking):
   * - Dispatches payment.received webhook
   */
  async recordPayment(ctx: InvoiceBusinessContext, input: RecordPaymentInput) {
    const invoice = await invoiceV2Repository.findById(
      input.invoiceId,
      ctx.userId
    );

    if (!invoice) {
      return null;
    }

    // Only allow payments for open invoices
    if (invoice.status !== "open") {
      throw new Error(
        `Cannot record payment for invoice with status '${invoice.status}'. Invoice must be 'open'.`
      );
    }

    const payment = await invoiceV2Repository.recordPayment({
      invoiceId: input.invoiceId,
      amount: input.amount,
      currency: input.currency ?? invoice.currency,
      method: input.method,
      reference: input.reference,
      paidAt: input.paidAt ?? new Date(),
      notes: input.notes,
      createdBy: ctx.userId,
    });

    logger.info(
      {
        userId: ctx.userId,
        invoiceId: input.invoiceId,
        paymentId: payment?.id,
        amount: input.amount,
      },
      "Payment recorded"
    );

    // Dispatch webhook (non-blocking)
    if (payment) {
      webhookDispatcher.paymentReceived(ctx.userId, {
        id: payment.id,
        amount: input.amount,
        currency: input.currency ?? invoice.currency,
        sourceType: "invoice",
        sourceId: input.invoiceId,
        sourceNumber: `${invoice.prefix}${invoice.serialNumber}`,
        partyName: (invoice.clientDetails as { name?: string })?.name,
      });
    }

    return payment;
  },

  /**
   * Delete an invoice (soft delete)
   *
   * Side effects (non-blocking):
   * - Dispatches invoice.deleted webhook
   */
  async delete(ctx: InvoiceBusinessContext, id: string) {
    // Get invoice first for webhook data
    const invoice = await invoiceV2Repository.findById(id, ctx.userId);

    if (!invoice) {
      return false;
    }

    const deleted = await invoiceV2Repository.delete(id, ctx.userId);

    if (!deleted) {
      return false;
    }

    logger.info({ userId: ctx.userId, invoiceId: id }, "Invoice deleted");

    // Dispatch webhook (non-blocking)
    webhookDispatcher.invoiceDeleted(
      ctx.userId,
      id,
      `${invoice.prefix}${invoice.serialNumber}`
    );

    return true;
  },
};

export type InvoiceBusiness = typeof invoiceBusiness;
