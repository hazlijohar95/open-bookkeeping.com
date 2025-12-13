import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { billRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { journalEntryIntegration } from "../../services/journalEntry.integration";
import { webhookDispatcher } from "../../services/webhook.integration";
import { documentStatusSchema, paginationBaseSchema } from "../../schemas/common";
import { assertFound } from "../../lib/errors";

const logger = createLogger("bill-service");

// Bill item schema (bills use strings for quantity/price due to form handling)
const billItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Quantity must be a positive number",
  }),
  unitPrice: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Unit price must be a non-negative number",
  }),
});

// Create bill schema
const createBillSchema = z.object({
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().min(1, "Bill number is required").max(100),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).default("MYR"),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  status: documentStatusSchema.default("pending"),
  notes: z.string().max(2000).optional(),
  attachmentUrl: z.string().url().max(500).optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
  // Tax support
  taxRate: z.string().refine((val) => val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
    message: "Tax rate must be a non-negative number",
  }).optional().nullable(),
});

// Update bill schema
const updateBillSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  currency: z.string().length(3).optional(),
  billDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  status: documentStatusSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
  items: z.array(billItemSchema).optional(),
});

// Pagination and filter schema for bills
const listBillsSchema = paginationBaseSchema.extend({
  vendorId: z.string().uuid().optional(),
  status: documentStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).optional();

export const billRouter = router({
  // List all bills for the user with pagination and filters
  list: protectedProcedure
    .input(listBillsSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0, vendorId, status, startDate, endDate } = input ?? {};

      const bills = await billRepository.findMany(ctx.user.id, {
        limit,
        offset,
        vendorId,
        status,
        startDate,
        endDate,
      });

      logger.debug({ userId: ctx.user.id, count: bills.length }, "Listed bills");
      return bills;
    }),

  // Get a single bill by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bill = await billRepository.findById(input.id, ctx.user.id);
      assertFound(bill, "bill", input.id);
      return bill;
    }),

  // Get bills by vendor
  getByVendor: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const bills = await billRepository.findByVendor(input.vendorId, ctx.user.id, {
        limit: input.limit,
        offset: input.offset,
      });

      return bills;
    }),

  // Get unpaid bills (for AP aging)
  getUnpaid: protectedProcedure
    .input(z.object({
      vendorId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const bills = await billRepository.getUnpaidBills(ctx.user.id, input?.vendorId);
      return bills;
    }),

  // Create a new bill
  create: protectedProcedure
    .input(createBillSchema)
    .mutation(async ({ ctx, input }) => {
      // Calculate totals from items
      const subtotal = input.items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice));
      }, 0);

      // Calculate tax amount if tax rate is provided
      const taxRate = input.taxRate ? parseFloat(input.taxRate) : 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      const bill = await billRepository.create({
        userId: ctx.user.id,
        vendorId: input.vendorId ?? null,
        billNumber: input.billNumber,
        description: input.description ?? null,
        currency: input.currency,
        billDate: input.billDate,
        dueDate: input.dueDate ?? null,
        status: input.status,
        notes: input.notes ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        // Financial totals
        subtotal: subtotal.toFixed(2),
        taxRate: taxRate > 0 ? taxRate.toFixed(2) : null,
        taxAmount: taxAmount > 0 ? taxAmount.toFixed(2) : null,
        total: total.toFixed(2),
        items: input.items,
      });

      logger.info({ userId: ctx.user.id, billId: bill?.id }, "Bill created");

      // Dispatch webhook event (non-blocking)
      if (bill?.id) {
        webhookDispatcher.billCreated(ctx.user.id, {
          id: bill.id,
          billNumber: input.billNumber,
          status: input.status,
          total: total,
          currency: input.currency,
          vendorId: input.vendorId,
          dueDate: input.dueDate,
        });
      }

      // Create journal entry in background (non-blocking)
      if (bill?.id) {
        journalEntryIntegration.hasChartOfAccounts(ctx.user.id).then(async (hasAccounts) => {
          if (hasAccounts) {
            // Get vendor name
            let vendorName = "Vendor";
            if (input.vendorId) {
              const fullBill = await billRepository.findById(bill.id, ctx.user.id);
              vendorName = (fullBill as { vendor?: { name: string } })?.vendor?.name ?? "Vendor";
            }

            journalEntryIntegration.createBillJournalEntry(ctx.user.id, {
              id: bill.id,
              billNumber: input.billNumber,
              date: input.billDate,
              currency: input.currency,
              subtotal: subtotal,
              taxAmount: taxAmount,
              total: total,
              vendorName: vendorName,
            }).then((jeResult) => {
              if (jeResult.success) {
                logger.info({ userId: ctx.user.id, billId: bill.id, entryId: jeResult.entryId }, "Journal entry created for bill");
              } else {
                logger.warn({ userId: ctx.user.id, billId: bill.id, error: jeResult.error }, "Failed to create journal entry for bill");
              }
            }).catch((err) => {
              logger.warn({ userId: ctx.user.id, billId: bill.id, error: err }, "Error creating journal entry for bill");
            });
          }
        }).catch(() => {
          // Silently ignore - chart of accounts not initialized
        });
      }

      return bill;
    }),

  // Update an existing bill
  update: protectedProcedure
    .input(updateBillSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await billRepository.update(input.id, ctx.user.id, {
        vendorId: input.vendorId,
        billNumber: input.billNumber,
        description: input.description,
        currency: input.currency,
        billDate: input.billDate,
        dueDate: input.dueDate,
        status: input.status,
        notes: input.notes,
        attachmentUrl: input.attachmentUrl,
        items: input.items,
      });

      assertFound(updated, "bill", input.id);

      logger.info({ userId: ctx.user.id, billId: input.id }, "Bill updated");
      return updated;
    }),

  // Update bill status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: documentStatusSchema,
      paidAt: z.coerce.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await billRepository.updateStatus(
        input.id,
        ctx.user.id,
        input.status,
        input.paidAt
      );

      assertFound(updated, "bill", input.id);

      logger.info({ userId: ctx.user.id, billId: input.id, status: input.status }, "Bill status updated");

      // Dispatch webhook event for bill paid
      if (input.status === "paid" && updated) {
        webhookDispatcher.billPaid(ctx.user.id, {
          id: input.id,
          billNumber: updated.billNumber,
          status: "paid",
          total: updated.total ?? undefined,
          currency: updated.currency,
          vendorId: updated.vendorId,
          paidAt: input.paidAt,
        });
      } else if (updated) {
        webhookDispatcher.billUpdated(ctx.user.id, {
          id: input.id,
          billNumber: updated.billNumber,
          status: input.status,
          total: updated.total ?? undefined,
          currency: updated.currency,
          vendorId: updated.vendorId,
        });
      }

      // Create payment journal entry when bill is marked as paid
      if (input.status === "paid") {
        journalEntryIntegration.hasChartOfAccounts(ctx.user.id).then(async (hasAccounts) => {
          if (hasAccounts) {
            // Get bill details for the payment entry
            const bill = await billRepository.findById(input.id, ctx.user.id);
            if (bill) {
              // Ensure paymentAmount is a number
              const rawTotal = bill.total;
              const paymentAmount = typeof rawTotal === "string" ? parseFloat(rawTotal) : (rawTotal ?? 0);
              const vendorName = (bill as { vendor?: { name: string } })?.vendor?.name ?? "Vendor";
              const billNumber = bill.billNumber || input.id;

              journalEntryIntegration.createPaymentJournalEntry(ctx.user.id, {
                sourceType: "bill",
                sourceId: input.id,
                sourceNumber: billNumber,
                amount: paymentAmount,
                date: input.paidAt || new Date(),
                partyName: vendorName,
              }).then((jeResult) => {
                if (jeResult.success) {
                  logger.info({ userId: ctx.user.id, billId: input.id, entryId: jeResult.entryId }, "Payment journal entry created for bill");
                } else {
                  logger.warn({ userId: ctx.user.id, billId: input.id, error: jeResult.error }, "Failed to create payment journal entry for bill");
                }
              }).catch((err) => {
                logger.warn({ userId: ctx.user.id, billId: input.id, error: err }, "Error creating payment journal entry for bill");
              });
            }
          }
        }).catch(() => {
          // Silently ignore - chart of accounts not initialized
        });
      }

      return updated;
    }),

  // Delete a bill
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await billRepository.delete(input.id, ctx.user.id);
      assertFound(deleted, "bill", input.id);

      logger.info({ userId: ctx.user.id, billId: input.id }, "Bill deleted");
      return { success: true };
    }),

  // Get AP aging report
  getAgingReport: protectedProcedure
    .input(
      z.object({
        vendorId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const report = await billRepository.getAgingReport(
        ctx.user.id,
        input?.vendorId
      );
      return report;
    }),
});
