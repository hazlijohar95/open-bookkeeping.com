import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  invoiceV2Repository,
  isValidStatusTransition,
  getValidNextStatuses,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { aggregationService } from "../../services/aggregation.service";
import { journalEntryIntegration } from "../../services/journalEntry.integration";
import { invoiceWebhooks } from "../../lib/webhooks";
import {
  paginationSchema,
  metadataItemSchema,
  billingDetailSchema,
  themeSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
} from "../../schemas/common";
import {
  forbidden,
  internalError,
  assertFound,
  badRequest,
} from "../../lib/errors";

const logger = createLogger("invoice-service");

// V2 Status values
const invoiceStatusV2Values = [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
  "refunded",
] as const;

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
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max 5s

      if (attempt < maxRetries) {
        logger.warn(
          { ...context, attempt, nextRetryMs: delay },
          "Aggregation update failed, retrying"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  logger.error(
    { ...context, error: lastError?.message, attempts: maxRetries },
    "Aggregation update failed after all retries"
  );
}

// V2 Invoice creation schema - uses flat structure
const createInvoiceV2Schema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  status: z.enum(invoiceStatusV2Values).optional().default("draft"),
  prefix: z.string(),
  serialNumber: z.string(),
  currency: z.string().default("MYR"),
  invoiceDate: z.date(),
  dueDate: z.date().nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  theme: themeSchema.nullable().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  billingDetails: z.array(billingDetailSchema).optional().default([]),
  metadata: z
    .object({
      notes: z.string().optional(),
      terms: z.string().optional(),
      paymentInformation: z.array(metadataItemSchema).optional(),
    })
    .optional(),
  items: z.array(documentItemSchema),
});

// Legacy schema for backwards compatibility during migration
const createInvoiceLegacySchema = z.object({
  customerId: z.string().uuid().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  invoiceDetails: z.object({
    theme: themeSchema.optional(),
    currency: z.string(),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.date(),
    dueDate: z.date().nullable().optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(documentItemSchema),
  metadata: z
    .object({
      notes: z.string().optional(),
      terms: z.string().optional(),
      paymentInformation: z.array(metadataItemSchema).optional(),
    })
    .optional(),
});

// Record payment schema
const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number(),
  method: z.string().optional(),
  reference: z.string().optional(),
  paidAt: z.date().optional(),
  notes: z.string().optional(),
});

// Helper to convert billing details value to string for V2 format
function convertBillingDetails(
  details: {
    label: string;
    value: number;
    type: "fixed" | "percentage";
    isSstTax?: boolean;
    sstTaxType?: "sales_tax" | "service_tax";
    sstRateCode?: string;
  }[]
): {
  label: string;
  value: string;
  type: "fixed" | "percentage";
  isSstTax?: boolean;
  sstTaxType?: "sales_tax" | "service_tax";
  sstRateCode?: string;
}[] {
  return details.map((d) => ({
    ...d,
    value: String(d.value),
  }));
}

export const invoiceRouter = router({
  // List invoices (V2 format) - uses lightweight query
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};

      const invoices = await invoiceV2Repository.findManyLight(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug(
        { userId: ctx.user.id, count: invoices.length },
        "Listed invoices (V2)"
      );
      return invoices;
    }),

  // Lightweight list for table views - same as list in V2
  listLight: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};

      const invoices = await invoiceV2Repository.findManyLight(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug(
        { userId: ctx.user.id, count: invoices.length },
        "Listed invoices (light V2)"
      );
      return invoices;
    }),

  // Get single invoice by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await invoiceV2Repository.findById(input.id, ctx.user.id);
      assertFound(invoice, "invoice", input.id);
      return invoice;
    }),

  // Create invoice (V2 format)
  insert: protectedProcedure
    .input(createInvoiceV2Schema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw forbidden("You have disabled data saving");
      }

      try {
        const result = await invoiceV2Repository.create({
          userId: ctx.user.id,
          customerId: input.customerId ?? undefined,
          status: input.status,
          prefix: input.prefix,
          serialNumber: input.serialNumber,
          currency: input.currency,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? undefined,
          paymentTerms: input.paymentTerms ?? undefined,
          theme: input.theme ?? undefined,
          companyDetails: input.companyDetails,
          clientDetails: input.clientDetails,
          billingDetails: input.billingDetails
            ? convertBillingDetails(input.billingDetails)
            : [],
          metadata: input.metadata,
          items: input.items.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });

        logger.info(
          { userId: ctx.user.id, invoiceId: result.invoiceId },
          "Invoice created (V2)"
        );

        // Trigger webhook in background (non-blocking)
        invoiceWebhooks.created(ctx.user.id, {
          id: result.invoiceId,
          invoiceNumber: `${input.prefix}${input.serialNumber}`,
          customerId: input.customerId,
          currency: input.currency,
          date: input.invoiceDate,
          dueDate: input.dueDate,
          status: input.status ?? "draft",
          itemCount: input.items.length,
        });

        // Create journal entry when invoice is issued (status = open)
        if (input.status === "open") {
          journalEntryIntegration
            .hasChartOfAccounts(ctx.user.id)
            .then((hasAccounts) => {
              if (hasAccounts) {
                journalEntryIntegration
                  .createInvoiceJournalEntry(ctx.user.id, {
                    id: result.invoiceId,
                    serialNumber: input.serialNumber,
                    date: input.invoiceDate,
                    currency: input.currency,
                    items: input.items,
                    billingDetails: input.billingDetails,
                    clientDetails: input.clientDetails,
                  })
                  .then((jeResult) => {
                    if (jeResult.success) {
                      logger.info(
                        {
                          userId: ctx.user.id,
                          invoiceId: result.invoiceId,
                          entryId: jeResult.entryId,
                        },
                        "Journal entry created for invoice"
                      );
                    } else {
                      logger.warn(
                        {
                          userId: ctx.user.id,
                          invoiceId: result.invoiceId,
                          error: jeResult.error,
                        },
                        "Failed to create journal entry for invoice"
                      );
                    }
                  })
                  .catch((err) => {
                    logger.warn(
                      {
                        userId: ctx.user.id,
                        invoiceId: result.invoiceId,
                        error: err,
                      },
                      "Error creating journal entry for invoice"
                    );
                  });
              }
            })
            .catch(() => {
              // Silently ignore - chart of accounts not initialized
            });
        }

        return result;
      } catch (error) {
        throw internalError("Failed to create invoice", error, {
          userId: ctx.user.id,
        });
      }
    }),

  // Legacy create endpoint for backwards compatibility
  insertLegacy: protectedProcedure
    .input(createInvoiceLegacySchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw forbidden("You have disabled data saving");
      }

      try {
        // Convert legacy format to V2 format
        const result = await invoiceV2Repository.create({
          userId: ctx.user.id,
          customerId: input.customerId,
          status: "open", // Legacy invoices are created as open
          prefix: input.invoiceDetails.prefix,
          serialNumber: input.invoiceDetails.serialNumber,
          currency: input.invoiceDetails.currency,
          invoiceDate: input.invoiceDetails.date,
          dueDate: input.invoiceDetails.dueDate ?? undefined,
          paymentTerms: input.invoiceDetails.paymentTerms,
          theme: input.invoiceDetails.theme,
          companyDetails: input.companyDetails,
          clientDetails: input.clientDetails,
          billingDetails: input.invoiceDetails.billingDetails
            ? convertBillingDetails(input.invoiceDetails.billingDetails)
            : [],
          metadata: input.metadata,
          items: input.items.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });

        logger.info(
          { userId: ctx.user.id, invoiceId: result.invoiceId },
          "Invoice created (legacy -> V2)"
        );

        return { invoiceId: result.invoiceId };
      } catch (error) {
        throw internalError("Failed to create invoice", error, {
          userId: ctx.user.id,
        });
      }
    }),

  // Delete invoice (soft delete)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await invoiceV2Repository.delete(input.id, ctx.user.id);

      if (!deleted) {
        assertFound(null, "invoice", input.id);
      }

      logger.info(
        { userId: ctx.user.id, invoiceId: input.id },
        "Invoice deleted"
      );

      // Trigger webhook in background (non-blocking)
      invoiceWebhooks.deleted(ctx.user.id, {
        id: input.id,
        deletedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  // Update invoice status (V2 with validation)
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(invoiceStatusV2Values),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current invoice to validate transition
      const invoice = await invoiceV2Repository.findById(input.id, ctx.user.id);
      assertFound(invoice, "invoice", input.id);

      // Validate status transition
      if (!isValidStatusTransition(invoice.status, input.status)) {
        const validStatuses = getValidNextStatuses(invoice.status);
        throw badRequest(
          `Cannot transition from '${invoice.status}' to '${input.status}'. Valid transitions: ${validStatuses.join(", ")}`
        );
      }

      const updated = await invoiceV2Repository.updateStatus(
        input.id,
        ctx.user.id,
        input.status
      );

      assertFound(updated, "invoice", input.id);

      logger.info(
        { userId: ctx.user.id, invoiceId: input.id, status: input.status },
        "Invoice status updated (V2)"
      );

      // Trigger webhook in background (non-blocking)
      invoiceWebhooks.updated(ctx.user.id, {
        id: input.id,
        status: input.status,
        updatedAt: new Date().toISOString(),
      });

      // Trigger invoice.paid webhook when status is "paid"
      if (input.status === "paid") {
        invoiceWebhooks.paid(ctx.user.id, {
          id: input.id,
          paidAt: new Date().toISOString(),
        });
      }

      // Trigger aggregation update in the background (non-blocking) with retry
      if (updated.createdAt) {
        const invoiceDate = new Date(updated.createdAt);
        retryAggregationUpdate(
          () =>
            aggregationService.updateInvoiceMonthlyTotals(
              ctx.user.id,
              invoiceDate.getFullYear(),
              invoiceDate.getMonth() + 1
            ),
          { userId: ctx.user.id, action: "updateInvoiceMonthlyTotals" }
        );
      }

      // Create payment journal entry when invoice is marked as paid
      if (input.status === "paid") {
        journalEntryIntegration
          .hasChartOfAccounts(ctx.user.id)
          .then(async (hasAccounts) => {
            if (hasAccounts) {
              const paymentAmount = parseFloat(invoice.total);
              const clientName =
                (invoice.clientDetails as { name?: string })?.name ??
                "Customer";

              journalEntryIntegration
                .createPaymentJournalEntry(ctx.user.id, {
                  sourceType: "invoice",
                  sourceId: input.id,
                  sourceNumber: `${invoice.prefix}${invoice.serialNumber}`,
                  amount: paymentAmount,
                  date: new Date(),
                  partyName: clientName,
                })
                .then((jeResult) => {
                  if (jeResult.success) {
                    logger.info(
                      {
                        userId: ctx.user.id,
                        invoiceId: input.id,
                        entryId: jeResult.entryId,
                      },
                      "Payment journal entry created"
                    );
                  } else {
                    logger.warn(
                      {
                        userId: ctx.user.id,
                        invoiceId: input.id,
                        error: jeResult.error,
                      },
                      "Failed to create payment journal entry"
                    );
                  }
                })
                .catch((err) => {
                  logger.warn(
                    { userId: ctx.user.id, invoiceId: input.id, error: err },
                    "Error creating payment journal entry"
                  );
                });
            }
          })
          .catch(() => {
            // Silently ignore - chart of accounts not initialized
          });
      }

      return { success: true };
    }),

  // Get valid status transitions for an invoice
  getStatusTransitions: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await invoiceV2Repository.findById(input.id, ctx.user.id);
      assertFound(invoice, "invoice", input.id);

      return {
        currentStatus: invoice.status,
        validTransitions: getValidNextStatuses(invoice.status),
      };
    }),

  // Record a payment for an invoice
  recordPayment: protectedProcedure
    .input(recordPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await invoiceV2Repository.findById(
        input.invoiceId,
        ctx.user.id
      );
      assertFound(invoice, "invoice", input.invoiceId);

      // Only allow payments for open invoices
      if (invoice.status !== "open") {
        throw badRequest(
          `Cannot record payment for invoice with status '${invoice.status}'. Invoice must be 'open'.`
        );
      }

      const payment = await invoiceV2Repository.recordPayment({
        invoiceId: input.invoiceId,
        amount: input.amount,
        currency: invoice.currency,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt ?? new Date(),
        notes: input.notes,
        createdBy: ctx.user.id,
      });

      logger.info(
        {
          userId: ctx.user.id,
          invoiceId: input.invoiceId,
          paymentId: payment?.id,
          amount: input.amount,
        },
        "Payment recorded"
      );

      return payment!;
    }),

  // Get invoices by customer
  getByCustomer: protectedProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const invoices = await invoiceV2Repository.findByCustomer(
        input.customerId,
        ctx.user.id,
        { limit: input.limit, offset: input.offset }
      );
      return invoices;
    }),

  // Get unpaid invoices by customer
  getUnpaidByCustomer: protectedProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoices = await invoiceV2Repository.getUnpaidByCustomer(
        input.customerId,
        ctx.user.id
      );
      return invoices;
    }),

  // Get next serial number for a prefix
  getNextSerialNumber: protectedProcedure
    .input(z.object({ prefix: z.string() }))
    .query(async ({ ctx, input }) => {
      const nextSerial = await invoiceV2Repository.getNextSerialNumber(
        ctx.user.id,
        input.prefix
      );
      return { serialNumber: nextSerial };
    }),
});
