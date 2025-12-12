import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { quotationRepository } from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { metadataItemSchema, billingDetailSchema } from "../../schemas/common";

const logger = createLogger("quotation-service");

// Zod schemas for quotation creation

const quotationItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  validUntil: z.string().optional(),
  companyDetails: z.object({
    name: z.string(),
    address: z.string(),
    logo: z.string().nullable().optional(),
    signature: z.string().nullable().optional(),
    metadata: z.array(metadataItemSchema).optional(),
  }),
  clientDetails: z.object({
    name: z.string(),
    address: z.string(),
    metadata: z.array(metadataItemSchema).optional(),
  }),
  quotationDetails: z.object({
    theme: z
      .object({
        baseColor: z.string(),
        mode: z.enum(["dark", "light"]),
        template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
      })
      .optional(),
    currency: z.string(),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.date(),
    validUntil: z.date().nullable().optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(quotationItemSchema),
  metadata: z
    .object({
      notes: z.string().optional(),
      terms: z.string().optional(),
      paymentInformation: z.array(metadataItemSchema).optional(),
    })
    .optional(),
});

// Pagination schema
const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
}).optional();

export const quotationRouter = router({
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};

      const quotations = await quotationRepository.findMany(ctx.user.id, {
        limit,
        offset,
      });

      logger.debug({ userId: ctx.user.id, count: quotations.length }, "Listed quotations");
      return quotations;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const quotation = await quotationRepository.findById(input.id, ctx.user.id);

      if (!quotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      return quotation;
    }),

  insert: protectedProcedure
    .input(createQuotationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have disabled data saving",
        });
      }

      try {
        const result = await quotationRepository.create({
          userId: ctx.user.id,
          customerId: input.customerId,
          validUntil: input.validUntil,
          companyDetails: input.companyDetails,
          clientDetails: input.clientDetails,
          quotationDetails: input.quotationDetails,
          items: input.items,
          metadata: input.metadata,
        });

        logger.info({ userId: ctx.user.id, quotationId: result.quotationId }, "Quotation created");
        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id }, "Failed to create quotation");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create quotation",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createQuotationSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have disabled data saving",
        });
      }

      try {
        const result = await quotationRepository.update(input.id, ctx.user.id, {
          userId: ctx.user.id,
          customerId: input.data.customerId,
          validUntil: input.data.validUntil,
          companyDetails: input.data.companyDetails,
          clientDetails: input.data.clientDetails,
          quotationDetails: input.data.quotationDetails,
          items: input.data.items,
          metadata: input.data.metadata,
        });

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Quotation not found",
          });
        }

        logger.info({ userId: ctx.user.id, quotationId: input.id }, "Quotation updated");
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error({ err: error, userId: ctx.user.id }, "Failed to update quotation");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update quotation",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await quotationRepository.delete(input.id, ctx.user.id);

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      logger.info({ userId: ctx.user.id, quotationId: input.id }, "Quotation deleted");
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await quotationRepository.updateStatus(
        input.id,
        ctx.user.id,
        input.status
      );

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
        });
      }

      logger.info(
        { userId: ctx.user.id, quotationId: input.id, status: input.status },
        "Quotation status updated"
      );
      return { success: true };
    }),

  convertToInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await quotationRepository.convertToInvoice(
          input.id,
          ctx.user.id
        );

        if ("error" in result) {
          if (result.error === "Quotation not found") {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: result.error,
            });
          }
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error,
          });
        }

        logger.info(
          {
            userId: ctx.user.id,
            quotationId: result.quotationId,
            invoiceId: result.invoiceId,
          },
          "Quotation converted to invoice"
        );
        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        logger.error({ err: error, userId: ctx.user.id }, "Failed to convert quotation to invoice");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to convert quotation to invoice",
          cause: error,
        });
      }
    }),
});
