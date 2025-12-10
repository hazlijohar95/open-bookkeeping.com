import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { invoiceRepository } from "@open-bookkeeping/db";
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
import { forbidden, internalError, assertFound } from "../../lib/errors";

const logger = createLogger("invoice-service");

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

// Invoice creation schema using common schemas
const createInvoiceSchema = z.object({
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

export const invoiceRouter = router({
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input || {};

      const invoices = await invoiceRepository.findMany(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug({ userId: ctx.user.id, count: invoices.length }, "Listed invoices");
      return invoices;
    }),

  // Lightweight list for table views - much faster than full list
  listLight: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input || {};

      const invoices = await invoiceRepository.findManyLight(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug({ userId: ctx.user.id, count: invoices.length }, "Listed invoices (light)");
      return invoices;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await invoiceRepository.findById(input.id, ctx.user.id);
      assertFound(invoice, "invoice", input.id);
      return invoice;
    }),

  insert: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw forbidden("You have disabled data saving");
      }

      try {
        const result = await invoiceRepository.create({
          userId: ctx.user.id,
          customerId: input.customerId,
          companyDetails: input.companyDetails,
          clientDetails: input.clientDetails,
          invoiceDetails: input.invoiceDetails,
          items: input.items,
          metadata: input.metadata,
        });

        logger.info({ userId: ctx.user.id, invoiceId: result.invoiceId }, "Invoice created");

        // Trigger webhook in background (non-blocking)
        invoiceWebhooks.created(ctx.user.id, {
          id: result.invoiceId,
          invoiceNumber: input.invoiceDetails.serialNumber,
          customerId: input.customerId,
          currency: input.invoiceDetails.currency,
          date: input.invoiceDetails.date,
          dueDate: input.invoiceDetails.dueDate,
          status: "pending",
          itemCount: input.items.length,
        });

        // Create journal entry in background (non-blocking)
        journalEntryIntegration.hasChartOfAccounts(ctx.user.id).then((hasAccounts) => {
          if (hasAccounts) {
            journalEntryIntegration.createInvoiceJournalEntry(ctx.user.id, {
              id: result.invoiceId,
              serialNumber: input.invoiceDetails.serialNumber,
              date: input.invoiceDetails.date,
              currency: input.invoiceDetails.currency,
              items: input.items,
              billingDetails: input.invoiceDetails.billingDetails,
              clientDetails: input.clientDetails,
            }).then((jeResult) => {
              if (jeResult.success) {
                logger.info({ userId: ctx.user.id, invoiceId: result.invoiceId, entryId: jeResult.entryId }, "Journal entry created for invoice");
              } else {
                logger.warn({ userId: ctx.user.id, invoiceId: result.invoiceId, error: jeResult.error }, "Failed to create journal entry for invoice");
              }
            }).catch((err) => {
              logger.warn({ userId: ctx.user.id, invoiceId: result.invoiceId, error: err }, "Error creating journal entry for invoice");
            });
          }
        }).catch(() => {
          // Silently ignore - chart of accounts not initialized
        });

        return result;
      } catch (error) {
        throw internalError("Failed to create invoice", error, { userId: ctx.user.id });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await invoiceRepository.delete(input.id, ctx.user.id);
      assertFound(deleted, "invoice", input.id);

      logger.info({ userId: ctx.user.id, invoiceId: input.id }, "Invoice deleted");

      // Trigger webhook in background (non-blocking)
      invoiceWebhooks.deleted(ctx.user.id, {
        id: input.id,
        deletedAt: new Date().toISOString(),
      });

      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["pending", "success", "error", "expired", "refunded"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await invoiceRepository.updateStatus(
        input.id,
        ctx.user.id,
        input.status
      );

      assertFound(updated, "invoice", input.id);

      logger.info(
        { userId: ctx.user.id, invoiceId: input.id, status: input.status },
        "Invoice status updated"
      );

      // Trigger webhook in background (non-blocking)
      invoiceWebhooks.updated(ctx.user.id, {
        id: input.id,
        status: input.status,
        updatedAt: new Date().toISOString(),
      });

      // Also trigger invoice.paid webhook when status is "success"
      if (input.status === "success") {
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

      // Create payment journal entry when invoice is marked as paid (status = success)
      if (input.status === "success") {
        journalEntryIntegration.hasChartOfAccounts(ctx.user.id).then(async (hasAccounts) => {
          if (hasAccounts) {
            // Get invoice details for the payment entry
            const invoice = await invoiceRepository.findById(input.id, ctx.user.id);
            if (invoice) {
              // Access nested invoiceFields structure
              const invoiceFields = invoice.invoiceFields as {
                invoiceDetails?: { total?: number; serialNumber?: string };
                clientDetails?: { name?: string };
              } | null;
              const paymentAmount = invoiceFields?.invoiceDetails?.total || 0;
              const clientName = invoiceFields?.clientDetails?.name || "Customer";
              const serialNumber = invoiceFields?.invoiceDetails?.serialNumber || input.id;

              journalEntryIntegration.createPaymentJournalEntry(ctx.user.id, {
                sourceType: "invoice",
                sourceId: input.id,
                sourceNumber: serialNumber,
                amount: paymentAmount,
                date: new Date(),
                partyName: clientName,
              }).then((jeResult) => {
                if (jeResult.success) {
                  logger.info({ userId: ctx.user.id, invoiceId: input.id, entryId: jeResult.entryId }, "Payment journal entry created");
                } else {
                  logger.warn({ userId: ctx.user.id, invoiceId: input.id, error: jeResult.error }, "Failed to create payment journal entry");
                }
              }).catch((err) => {
                logger.warn({ userId: ctx.user.id, invoiceId: input.id, error: err }, "Error creating payment journal entry");
              });
            }
          }
        }).catch(() => {
          // Silently ignore - chart of accounts not initialized
        });
      }

      return { success: true };
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
      const invoices = await invoiceRepository.findByCustomer(
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
      const invoices = await invoiceRepository.getUnpaidByCustomer(
        input.customerId,
        ctx.user.id
      );
      return invoices;
    }),

  // Get AR aging report
  getAgingReport: protectedProcedure
    .input(
      z.object({
        customerId: z.string().uuid().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const report = await invoiceRepository.getAgingReport(
        ctx.user.id,
        input?.customerId
      );
      return report;
    }),
});
