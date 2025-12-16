/**
 * Invoice V2 Repository
 *
 * Implements full CRUD operations for the consolidated invoice_v2 schema.
 * Features:
 * - Status state machine validation
 * - Decimal.js for precise money calculations
 * - Activity logging for audit trail
 * - Partial payment support
 */

import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { db } from "../index";
import {
  invoicesV2,
  invoiceItemsV2,
  invoicePaymentsV2,
  invoiceActivitiesV2,
  type InvoiceTheme,
  type CompanyDetailsV2,
  type ClientDetailsV2,
  type BillingDetailV2,
  type InvoiceMetadataV2,
} from "../schema/invoicesV2";
import type { InvoiceStatusV2 } from "../schema/enums";
import Decimal from "decimal.js";

// ============================================
// STATUS STATE MACHINE
// ============================================

/**
 * Valid status transitions following Stripe's invoice lifecycle model.
 * Terminal states (paid, void, refunded) cannot transition to any other state.
 */
const VALID_TRANSITIONS: Record<InvoiceStatusV2, InvoiceStatusV2[]> = {
  draft: ["open", "void"],
  open: ["paid", "void", "uncollectible"],
  paid: ["refunded"],
  void: [], // Terminal state
  uncollectible: ["void", "paid"], // Can recover or write off
  refunded: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: InvoiceStatusV2,
  to: InvoiceStatusV2
): boolean {
  if (from === to) return true; // No change is always valid
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses for a given status
 */
export function getValidNextStatuses(
  status: InvoiceStatusV2
): InvoiceStatusV2[] {
  return VALID_TRANSITIONS[status] ?? [];
}

// ============================================
// TYPES
// ============================================

export interface InvoiceItemInput {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  sku?: string;
  taxRate?: number;
  discount?: number;
}

export interface CreateInvoiceV2Input {
  userId: string;
  customerId?: string | null;
  vendorId?: string | null;
  status?: InvoiceStatusV2;
  prefix: string;
  serialNumber: string;
  currency: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  paymentTerms?: string;
  theme?: InvoiceTheme;
  companyDetails: CompanyDetailsV2;
  clientDetails: ClientDetailsV2;
  billingDetails?: BillingDetailV2[];
  metadata?: InvoiceMetadataV2;
  items: InvoiceItemInput[];
}

export interface UpdateInvoiceV2Input {
  customerId?: string | null;
  vendorId?: string | null;
  prefix?: string;
  serialNumber?: string;
  currency?: string;
  invoiceDate?: Date;
  dueDate?: Date | null;
  paymentTerms?: string;
  theme?: InvoiceTheme;
  companyDetails?: CompanyDetailsV2;
  clientDetails?: ClientDetailsV2;
  billingDetails?: BillingDetailV2[];
  metadata?: InvoiceMetadataV2;
  items?: InvoiceItemInput[];
}

export interface InvoiceV2ListItem {
  id: string;
  status: InvoiceStatusV2;
  prefix: string;
  serialNumber: string;
  currency: string;
  total: string;
  amountDue: string;
  invoiceDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  clientName: string;
  customerId: string | null;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  currency: string;
  method?: string;
  reference?: string;
  paidAt: Date;
  notes?: string;
  createdBy: string;
}

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Calculate invoice totals using Decimal.js for precision.
 * Avoids floating-point errors in money calculations.
 */
function calculateTotals(
  items: InvoiceItemInput[],
  billingDetails: BillingDetailV2[] = []
): {
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  amountDue: string;
  amountPaid: string;
} {
  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    const lineTotal = new Decimal(item.quantity).times(item.unitPrice);
    // Apply item-level discount if present
    const discount = item.discount
      ? lineTotal.times(item.discount).div(100)
      : new Decimal(0);
    return sum.plus(lineTotal.minus(discount));
  }, new Decimal(0));

  // Calculate taxes and discounts from billing details
  let taxTotal = new Decimal(0);
  let discountTotal = new Decimal(0);

  for (const detail of billingDetails) {
    const value = new Decimal(detail.value);
    const amount =
      detail.type === "percentage" ? subtotal.times(value).div(100) : value;

    // Positive values are taxes/fees, negative are discounts
    if (value.greaterThanOrEqualTo(0)) {
      taxTotal = taxTotal.plus(amount);
    } else {
      discountTotal = discountTotal.plus(amount.abs());
    }
  }

  const total = subtotal.plus(taxTotal).minus(discountTotal);

  return {
    subtotal: subtotal.toFixed(2),
    taxTotal: taxTotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    total: total.toFixed(2),
    amountDue: total.toFixed(2),
    amountPaid: "0.00",
  };
}

// ============================================
// REPOSITORY
// ============================================

export const invoiceV2Repository = {
  // ----------------------------------------
  // READ OPERATIONS
  // ----------------------------------------

  /**
   * Find invoice by ID with all relations
   */
  findById: async (id: string, userId: string) => {
    const invoice = await db.query.invoicesV2.findFirst({
      where: and(
        eq(invoicesV2.id, id),
        eq(invoicesV2.userId, userId),
        isNull(invoicesV2.deletedAt)
      ),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
        payments: {
          orderBy: (payments, { desc }) => [desc(payments.paidAt)],
        },
        customer: true,
        activities: {
          orderBy: (activities, { desc }) => [desc(activities.performedAt)],
          limit: 10,
        },
      },
    });
    return invoice;
  },

  /**
   * Lightweight list for table views - optimized query
   */
  findManyLight: async (
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<InvoiceV2ListItem[]> => {
    const { limit = 50, offset = 0 } = options ?? {};

    const invoices = await db.query.invoicesV2.findMany({
      where: and(eq(invoicesV2.userId, userId), isNull(invoicesV2.deletedAt)),
      columns: {
        id: true,
        status: true,
        prefix: true,
        serialNumber: true,
        currency: true,
        total: true,
        amountDue: true,
        invoiceDate: true,
        dueDate: true,
        createdAt: true,
        paidAt: true,
        customerId: true,
        clientDetails: true,
      },
      limit,
      offset,
      orderBy: [desc(invoicesV2.createdAt)],
    });

    return invoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      prefix: inv.prefix,
      serialNumber: inv.serialNumber,
      currency: inv.currency,
      total: inv.total,
      amountDue: inv.amountDue,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
      paidAt: inv.paidAt,
      clientName: (inv.clientDetails as ClientDetailsV2)?.name ?? "",
      customerId: inv.customerId,
    }));
  },

  /**
   * Find invoices by customer
   */
  findByCustomer: async (
    customerId: string,
    userId: string,
    options?: { limit?: number; offset?: number }
  ) => {
    const { limit = 50, offset = 0 } = options ?? {};

    return db.query.invoicesV2.findMany({
      where: and(
        eq(invoicesV2.customerId, customerId),
        eq(invoicesV2.userId, userId),
        isNull(invoicesV2.deletedAt)
      ),
      limit,
      offset,
      orderBy: [desc(invoicesV2.createdAt)],
    });
  },

  /**
   * Get unpaid invoices for a customer (for statements)
   */
  getUnpaidByCustomer: async (customerId: string, userId: string) => {
    return db.query.invoicesV2.findMany({
      where: and(
        eq(invoicesV2.customerId, customerId),
        eq(invoicesV2.userId, userId),
        isNull(invoicesV2.deletedAt),
        sql`${invoicesV2.status} IN ('open', 'uncollectible')`
      ),
      with: {
        items: true,
      },
      orderBy: [desc(invoicesV2.dueDate)],
    });
  },

  // ----------------------------------------
  // CREATE OPERATION
  // ----------------------------------------

  /**
   * Create a new invoice with items
   */
  create: async (input: CreateInvoiceV2Input) => {
    return db.transaction(async (tx) => {
      const totals = calculateTotals(input.items, input.billingDetails);

      const [invoice] = await tx
        .insert(invoicesV2)
        .values({
          userId: input.userId,
          customerId: input.customerId,
          vendorId: input.vendorId,
          status: input.status ?? "draft",
          prefix: input.prefix,
          serialNumber: input.serialNumber,
          currency: input.currency,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          paymentTerms: input.paymentTerms,
          theme: input.theme,
          companyDetails: input.companyDetails,
          clientDetails: input.clientDetails,
          billingDetails: input.billingDetails ?? [],
          metadata: input.metadata ?? {},
          ...totals,
        })
        .returning();

      if (input.items.length > 0) {
        await tx.insert(invoiceItemsV2).values(
          input.items.map((item, index) => ({
            invoiceId: invoice!.id,
            name: item.name,
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            amount: new Decimal(item.quantity).times(item.unitPrice).toFixed(2),
            unit: item.unit,
            sku: item.sku,
            taxRate: item.taxRate ? String(item.taxRate) : undefined,
            discount: item.discount ? String(item.discount) : undefined,
            sortOrder: String(index),
          }))
        );
      }

      // Log creation activity
      await tx.insert(invoiceActivitiesV2).values({
        invoiceId: invoice!.id,
        action: "created",
        description: `Invoice ${input.prefix}${input.serialNumber} created`,
        performedBy: input.userId,
      });

      return { invoiceId: invoice!.id };
    });
  },

  // ----------------------------------------
  // UPDATE OPERATIONS
  // ----------------------------------------

  /**
   * Update invoice details.
   * Only allowed for draft and open invoices.
   * For open invoices, only metadata can be updated.
   */
  update: async (id: string, userId: string, input: UpdateInvoiceV2Input) => {
    return db.transaction(async (tx) => {
      // Get current invoice
      const existing = await tx.query.invoicesV2.findFirst({
        where: and(
          eq(invoicesV2.id, id),
          eq(invoicesV2.userId, userId),
          isNull(invoicesV2.deletedAt)
        ),
      });

      if (!existing) return null;

      // Check update permissions based on status
      if (
        existing.status === "paid" ||
        existing.status === "void" ||
        existing.status === "refunded"
      ) {
        throw new Error(
          `Cannot update invoice with status '${existing.status}'. Create a credit note instead.`
        );
      }

      // For open invoices, only allow metadata updates
      if (existing.status === "open") {
        const allowedFields = ["metadata"];
        const attemptedFields = Object.keys(input);
        const disallowedFields = attemptedFields.filter(
          (f) => !allowedFields.includes(f)
        );

        if (disallowedFields.length > 0) {
          throw new Error(
            `Cannot update ${disallowedFields.join(", ")} on an open invoice. Only metadata is allowed.`
          );
        }
      }

      // Recalculate totals if items changed
      let totals = {};
      if (input.items) {
        totals = calculateTotals(
          input.items,
          input.billingDetails ?? (existing.billingDetails as BillingDetailV2[])
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.customerId !== undefined)
        updateData.customerId = input.customerId;
      if (input.vendorId !== undefined) updateData.vendorId = input.vendorId;
      if (input.prefix !== undefined) updateData.prefix = input.prefix;
      if (input.serialNumber !== undefined)
        updateData.serialNumber = input.serialNumber;
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.invoiceDate !== undefined)
        updateData.invoiceDate = input.invoiceDate;
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
      if (input.paymentTerms !== undefined)
        updateData.paymentTerms = input.paymentTerms;
      if (input.theme !== undefined) updateData.theme = input.theme;
      if (input.companyDetails !== undefined)
        updateData.companyDetails = input.companyDetails;
      if (input.clientDetails !== undefined)
        updateData.clientDetails = input.clientDetails;
      if (input.billingDetails !== undefined)
        updateData.billingDetails = input.billingDetails;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      Object.assign(updateData, totals);

      const [updated] = await tx
        .update(invoicesV2)
        .set(updateData)
        .where(and(eq(invoicesV2.id, id), eq(invoicesV2.userId, userId)))
        .returning();

      // Update items if provided
      if (input.items) {
        // Delete existing items
        await tx.delete(invoiceItemsV2).where(eq(invoiceItemsV2.invoiceId, id));

        // Insert new items
        if (input.items.length > 0) {
          await tx.insert(invoiceItemsV2).values(
            input.items.map((item, index) => ({
              invoiceId: id,
              name: item.name,
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              amount: new Decimal(item.quantity)
                .times(item.unitPrice)
                .toFixed(2),
              unit: item.unit,
              sku: item.sku,
              taxRate: item.taxRate ? String(item.taxRate) : undefined,
              discount: item.discount ? String(item.discount) : undefined,
              sortOrder: String(index),
            }))
          );
        }
      }

      // Log update activity
      await tx.insert(invoiceActivitiesV2).values({
        invoiceId: id,
        action: "updated",
        description: "Invoice updated",
        performedBy: userId,
      });

      return updated;
    });
  },

  /**
   * Update invoice status with state machine validation
   */
  updateStatus: async (
    id: string,
    userId: string,
    newStatus: InvoiceStatusV2
  ) => {
    // Get current invoice
    const existing = await db.query.invoicesV2.findFirst({
      where: and(
        eq(invoicesV2.id, id),
        eq(invoicesV2.userId, userId),
        isNull(invoicesV2.deletedAt)
      ),
    });

    if (!existing) return null;

    // Validate status transition
    if (!isValidStatusTransition(existing.status, newStatus)) {
      throw new Error(
        `Invalid status transition from '${existing.status}' to '${newStatus}'. ` +
          `Valid transitions: ${getValidNextStatuses(existing.status).join(", ") || "none (terminal state)"}`
      );
    }

    // If no change, return existing
    if (existing.status === newStatus) {
      return existing;
    }

    return db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date(),
      };

      // Set paidAt when status becomes paid
      if (newStatus === "paid") {
        updateData.paidAt = new Date();
        updateData.amountDue = "0.00";
        updateData.amountPaid = existing.total;
      }

      const [updated] = await tx
        .update(invoicesV2)
        .set(updateData)
        .where(and(eq(invoicesV2.id, id), eq(invoicesV2.userId, userId)))
        .returning();

      // Log status change activity
      await tx.insert(invoiceActivitiesV2).values({
        invoiceId: id,
        action: "status_changed",
        description: `Status changed from ${existing.status} to ${newStatus}`,
        changes: {
          status: { old: existing.status, new: newStatus },
        },
        performedBy: userId,
      });

      return updated;
    });
  },

  // ----------------------------------------
  // DELETE OPERATION
  // ----------------------------------------

  /**
   * Soft delete an invoice
   */
  delete: async (id: string, userId: string) => {
    const existing = await db.query.invoicesV2.findFirst({
      where: and(
        eq(invoicesV2.id, id),
        eq(invoicesV2.userId, userId),
        isNull(invoicesV2.deletedAt)
      ),
    });

    if (!existing) return false;

    // Don't allow deleting paid invoices
    if (existing.status === "paid") {
      throw new Error(
        "Cannot delete a paid invoice. Void it instead or create a credit note."
      );
    }

    await db
      .update(invoicesV2)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(invoicesV2.id, id), eq(invoicesV2.userId, userId)));

    return true;
  },

  // ----------------------------------------
  // PAYMENT OPERATIONS
  // ----------------------------------------

  /**
   * Record a payment against an invoice
   */
  recordPayment: async (input: RecordPaymentInput) => {
    return db.transaction(async (tx) => {
      // Get current invoice
      const invoice = await tx.query.invoicesV2.findFirst({
        where: and(
          eq(invoicesV2.id, input.invoiceId),
          isNull(invoicesV2.deletedAt)
        ),
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status !== "open" && invoice.status !== "uncollectible") {
        throw new Error(
          `Cannot record payment for invoice with status '${invoice.status}'`
        );
      }

      // Insert payment record
      const [payment] = await tx
        .insert(invoicePaymentsV2)
        .values({
          invoiceId: input.invoiceId,
          amount: String(input.amount),
          currency: input.currency,
          method: input.method,
          reference: input.reference,
          paidAt: input.paidAt,
          notes: input.notes,
          createdBy: input.createdBy,
        })
        .returning();

      // Update invoice amounts
      const newAmountPaid = new Decimal(invoice.amountPaid).plus(input.amount);
      const newAmountDue = new Decimal(invoice.total).minus(newAmountPaid);
      const isPaid = newAmountDue.lessThanOrEqualTo(0);

      await tx
        .update(invoicesV2)
        .set({
          amountPaid: newAmountPaid.toFixed(2),
          amountDue: newAmountDue.greaterThan(0)
            ? newAmountDue.toFixed(2)
            : "0.00",
          status: isPaid ? "paid" : "open",
          paidAt: isPaid ? new Date() : invoice.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(invoicesV2.id, input.invoiceId));

      // Log payment activity
      await tx.insert(invoiceActivitiesV2).values({
        invoiceId: input.invoiceId,
        action: "payment_recorded",
        description: `Payment of ${input.currency} ${input.amount} recorded`,
        performedBy: input.createdBy,
      });

      return payment;
    });
  },

  // ----------------------------------------
  // UTILITY METHODS
  // ----------------------------------------

  /**
   * Check if an invoice exists
   */
  exists: async (id: string, userId: string) => {
    const invoice = await db.query.invoicesV2.findFirst({
      where: and(
        eq(invoicesV2.id, id),
        eq(invoicesV2.userId, userId),
        isNull(invoicesV2.deletedAt)
      ),
      columns: { id: true },
    });
    return !!invoice;
  },

  /**
   * Get the next serial number for a prefix
   */
  getNextSerialNumber: async (userId: string, prefix: string) => {
    const result = await db
      .select({ serialNumber: invoicesV2.serialNumber })
      .from(invoicesV2)
      .where(and(eq(invoicesV2.userId, userId), eq(invoicesV2.prefix, prefix)))
      .orderBy(desc(invoicesV2.createdAt))
      .limit(1);

    const firstResult = result[0];
    if (!firstResult) {
      return "00001";
    }

    const lastNumber = parseInt(firstResult.serialNumber, 10);
    if (isNaN(lastNumber)) {
      return "00001";
    }

    return String(lastNumber + 1).padStart(5, "0");
  },
};

export type InvoiceV2Repository = typeof invoiceV2Repository;
