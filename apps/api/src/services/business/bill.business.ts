/**
 * Bill Business Service
 *
 * Centralized business logic for bill (accounts payable) operations.
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

import { billRepository, type BillStatus } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { journalEntryIntegration } from "../journalEntry.integration";
import { webhookDispatcher } from "../webhook.integration";

const logger = createLogger("bill-business");

// ============================================
// Types
// ============================================

export interface BillItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface CreateBillInput {
  vendorId?: string | null;
  billNumber: string;
  description?: string | null;
  currency?: string;
  billDate: Date;
  dueDate?: Date | null;
  status?: BillStatus;
  notes?: string | null;
  attachmentUrl?: string | null;
  items?: BillItem[];
  taxRate?: string | null;
}

export interface UpdateBillInput {
  vendorId?: string | null;
  billNumber?: string;
  description?: string | null;
  currency?: string;
  billDate?: Date;
  dueDate?: Date | null;
  status?: BillStatus;
  notes?: string | null;
  attachmentUrl?: string | null;
  items?: BillItem[];
}

export interface BillBusinessContext {
  userId: string;
  allowedSavingData?: boolean;
}

// BillStatus is imported from @open-bookkeeping/db

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate bill totals from items
 */
function calculateBillTotals(
  items: BillItem[],
  taxRate?: string | null
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice);
  }, 0);

  const taxRateNum = taxRate ? parseFloat(taxRate) : 0;
  const taxAmount = subtotal * (taxRateNum / 100);
  const total = subtotal + taxAmount;

  return { subtotal, taxAmount, total };
}

/**
 * Create bill journal entry in background (non-blocking)
 */
function createBillJournalEntryAsync(
  userId: string,
  billId: string,
  billData: {
    billNumber: string;
    date: Date;
    currency: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    vendorName: string;
  }
): void {
  journalEntryIntegration
    .hasChartOfAccounts(userId)
    .then(async (hasAccounts) => {
      if (hasAccounts) {
        journalEntryIntegration
          .createBillJournalEntry(userId, {
            id: billId,
            billNumber: billData.billNumber,
            date: billData.date,
            currency: billData.currency,
            subtotal: billData.subtotal,
            taxAmount: billData.taxAmount,
            total: billData.total,
            vendorName: billData.vendorName,
          })
          .then((result) => {
            if (result.success) {
              logger.info(
                { userId, billId, entryId: result.entryId },
                "Journal entry created for bill"
              );
            } else {
              logger.warn(
                { userId, billId, error: result.error },
                "Failed to create journal entry for bill"
              );
            }
          })
          .catch((err) => {
            logger.warn(
              { userId, billId, error: err },
              "Error creating journal entry for bill"
            );
          });
      }
    })
    .catch(() => {
      // Silently ignore - chart of accounts not initialized
    });
}

/**
 * Create payment journal entry for bill in background (non-blocking)
 */
function createBillPaymentJournalEntryAsync(
  userId: string,
  billId: string,
  bill: {
    billNumber: string;
    total: string | number | null;
    vendorName: string;
  },
  paidAt?: Date
): void {
  journalEntryIntegration
    .hasChartOfAccounts(userId)
    .then(async (hasAccounts) => {
      if (hasAccounts) {
        const rawTotal = bill.total;
        const paymentAmount =
          typeof rawTotal === "string" ? parseFloat(rawTotal) : (rawTotal ?? 0);

        journalEntryIntegration
          .createPaymentJournalEntry(userId, {
            sourceType: "bill",
            sourceId: billId,
            sourceNumber: bill.billNumber,
            amount: paymentAmount,
            date: paidAt || new Date(),
            partyName: bill.vendorName,
          })
          .then((result) => {
            if (result.success) {
              logger.info(
                { userId, billId, entryId: result.entryId },
                "Payment journal entry created for bill"
              );
            } else {
              logger.warn(
                { userId, billId, error: result.error },
                "Failed to create payment journal entry for bill"
              );
            }
          })
          .catch((err) => {
            logger.warn(
              { userId, billId, error: err },
              "Error creating payment journal entry for bill"
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

export const billBusiness = {
  /**
   * List bills with optional filters
   */
  async list(
    ctx: BillBusinessContext,
    options?: {
      limit?: number;
      offset?: number;
      vendorId?: string;
      status?: BillStatus;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const {
      limit = 50,
      offset = 0,
      vendorId,
      status,
      startDate,
      endDate,
    } = options ?? {};

    const bills = await billRepository.findMany(ctx.userId, {
      limit,
      offset,
      vendorId,
      status,
      startDate,
      endDate,
    });

    logger.debug({ userId: ctx.userId, count: bills.length }, "Listed bills");

    return bills;
  },

  /**
   * Get a single bill by ID
   */
  async getById(ctx: BillBusinessContext, id: string) {
    const bill = await billRepository.findById(id, ctx.userId);

    if (!bill) {
      logger.debug({ userId: ctx.userId, billId: id }, "Bill not found");
      return null;
    }

    return bill;
  },

  /**
   * Get bills by vendor
   */
  async getByVendor(
    ctx: BillBusinessContext,
    vendorId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const { limit = 50, offset = 0 } = options ?? {};

    return billRepository.findByVendor(vendorId, ctx.userId, {
      limit,
      offset,
    });
  },

  /**
   * Get unpaid bills (for AP aging)
   */
  async getUnpaid(ctx: BillBusinessContext, vendorId?: string) {
    return billRepository.getUnpaidBills(ctx.userId, vendorId);
  },

  /**
   * Get AP aging report
   */
  async getAgingReport(ctx: BillBusinessContext, vendorId?: string) {
    return billRepository.getAgingReport(ctx.userId, vendorId);
  },

  /**
   * Create a new bill
   *
   * Side effects (non-blocking):
   * - Dispatches bill.created webhook
   * - Creates journal entry if chart of accounts exists
   */
  async create(ctx: BillBusinessContext, input: CreateBillInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    // Calculate totals from items (if provided)
    const { subtotal, taxAmount, total } = calculateBillTotals(
      input.items ?? [],
      input.taxRate
    );

    const taxRateNum = input.taxRate ? parseFloat(input.taxRate) : 0;

    const bill = await billRepository.create({
      userId: ctx.userId,
      vendorId: input.vendorId ?? null,
      billNumber: input.billNumber,
      description: input.description ?? null,
      currency: input.currency ?? "MYR",
      billDate: input.billDate,
      dueDate: input.dueDate ?? null,
      status: input.status ?? "pending",
      notes: input.notes ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      subtotal: subtotal.toFixed(2),
      taxRate: taxRateNum > 0 ? taxRateNum.toFixed(2) : null,
      taxAmount: taxAmount > 0 ? taxAmount.toFixed(2) : null,
      total: total.toFixed(2),
      items: input.items,
    });

    logger.info({ userId: ctx.userId, billId: bill?.id }, "Bill created");

    // Dispatch webhook (non-blocking)
    if (bill?.id) {
      webhookDispatcher.billCreated(ctx.userId, {
        id: bill.id,
        billNumber: input.billNumber,
        status: input.status ?? "pending",
        total: total,
        currency: input.currency ?? "MYR",
        vendorId: input.vendorId,
        dueDate: input.dueDate,
      });

      // Get vendor name for journal entry
      const fullBill = await billRepository.findById(bill.id, ctx.userId);
      const vendorName =
        (fullBill as { vendor?: { name: string } })?.vendor?.name ?? "Vendor";

      // Create journal entry in background
      createBillJournalEntryAsync(ctx.userId, bill.id, {
        billNumber: input.billNumber,
        date: input.billDate,
        currency: input.currency ?? "MYR",
        subtotal,
        taxAmount,
        total,
        vendorName,
      });
    }

    return bill;
  },

  /**
   * Update an existing bill
   *
   * Side effects (non-blocking):
   * - Dispatches bill.updated webhook
   */
  async update(ctx: BillBusinessContext, id: string, input: UpdateBillInput) {
    if (ctx.allowedSavingData === false) {
      throw new Error("You have disabled data saving");
    }

    const updated = await billRepository.update(id, ctx.userId, input);

    if (!updated) {
      logger.debug({ userId: ctx.userId, billId: id }, "Bill not found");
      return null;
    }

    logger.info({ userId: ctx.userId, billId: id }, "Bill updated");

    // Dispatch webhook (non-blocking)
    webhookDispatcher.billUpdated(ctx.userId, {
      id,
      billNumber: updated.billNumber,
      status: updated.status,
      total: updated.total ?? undefined,
      currency: updated.currency,
      vendorId: updated.vendorId,
    });

    return updated;
  },

  /**
   * Update bill status
   *
   * Side effects (non-blocking):
   * - Dispatches bill.updated or bill.paid webhook
   * - Creates payment journal entry if status becomes "paid"
   * - Updates aggregations
   */
  async updateStatus(
    ctx: BillBusinessContext,
    id: string,
    status: BillStatus,
    paidAt?: Date
  ) {
    const updated = await billRepository.updateStatus(
      id,
      ctx.userId,
      status,
      paidAt
    );

    if (!updated) {
      return null;
    }

    logger.info(
      { userId: ctx.userId, billId: id, status },
      "Bill status updated"
    );

    // Dispatch appropriate webhook (non-blocking)
    if (status === "paid") {
      webhookDispatcher.billPaid(ctx.userId, {
        id,
        billNumber: updated.billNumber,
        status: "paid",
        total: updated.total ?? undefined,
        currency: updated.currency,
        vendorId: updated.vendorId,
        paidAt: paidAt,
      });
    } else {
      webhookDispatcher.billUpdated(ctx.userId, {
        id,
        billNumber: updated.billNumber,
        status,
        total: updated.total ?? undefined,
        currency: updated.currency,
        vendorId: updated.vendorId,
      });
    }

    // Note: Bill aggregations are not yet implemented in aggregationService
    // TODO: Add updateBillMonthlyTotals to aggregationService when needed

    // Create payment journal entry when marked as paid
    if (status === "paid") {
      const vendorName =
        (updated as { vendor?: { name: string } })?.vendor?.name ?? "Vendor";

      createBillPaymentJournalEntryAsync(
        ctx.userId,
        id,
        {
          billNumber: updated.billNumber,
          total: updated.total,
          vendorName,
        },
        paidAt
      );
    }

    return updated;
  },

  /**
   * Delete a bill
   */
  async delete(ctx: BillBusinessContext, id: string) {
    const deleted = await billRepository.delete(id, ctx.userId);

    if (!deleted) {
      logger.debug({ userId: ctx.userId, billId: id }, "Bill not found");
      return false;
    }

    logger.info({ userId: ctx.userId, billId: id }, "Bill deleted");

    return true;
  },
};

export type BillBusiness = typeof billBusiness;
