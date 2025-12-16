import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { quotationBusiness } from "../../services/business";
import { metadataItemSchema, billingDetailSchema } from "../../schemas/common";

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
        template: z
          .enum(["default", "cynco", "classic", "zen", "executive"])
          .optional(),
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
const paginationSchema = z
  .object({
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
  })
  .optional();

export const quotationRouter = router({
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};

      return quotationBusiness.list({ userId: ctx.user.id }, { limit, offset });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const quotation = await quotationBusiness.getById(
        { userId: ctx.user.id },
        input.id
      );

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
      try {
        // Transform billingDetails to ensure value is a number
        const quotationDetails = {
          ...input.quotationDetails,
          billingDetails: input.quotationDetails.billingDetails?.map((bd) => ({
            ...bd,
            value:
              typeof bd.value === "string" ? parseFloat(bd.value) : bd.value,
          })),
        };

        return await quotationBusiness.create(
          {
            userId: ctx.user.id,
            allowedSavingData: ctx.user.allowedSavingData,
          },
          {
            customerId: input.customerId,
            validUntil: input.validUntil,
            companyDetails: input.companyDetails,
            clientDetails: input.clientDetails,
            quotationDetails,
            items: input.items,
            metadata: input.metadata,
          }
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "You have disabled data saving"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
          });
        }
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
      try {
        // Transform billingDetails to ensure value is a number
        const quotationDetails = {
          ...input.data.quotationDetails,
          billingDetails: input.data.quotationDetails.billingDetails?.map(
            (bd) => ({
              ...bd,
              value:
                typeof bd.value === "string" ? parseFloat(bd.value) : bd.value,
            })
          ),
        };

        const result = await quotationBusiness.update(
          {
            userId: ctx.user.id,
            allowedSavingData: ctx.user.allowedSavingData,
          },
          input.id,
          {
            customerId: input.data.customerId,
            validUntil: input.data.validUntil,
            companyDetails: input.data.companyDetails,
            clientDetails: input.data.clientDetails,
            quotationDetails,
            items: input.data.items,
            metadata: input.data.metadata,
          }
        );

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Quotation not found",
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (
          error instanceof Error &&
          error.message === "You have disabled data saving"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
          });
        }
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
      const deleted = await quotationBusiness.delete(
        { userId: ctx.user.id },
        input.id
      );

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

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
      try {
        const result = await quotationBusiness.updateStatus(
          { userId: ctx.user.id },
          input.id,
          input.status
        );

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Quotation not found",
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  convertToInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await quotationBusiness.convertToInvoice(
          { userId: ctx.user.id },
          input.id
        );

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Quotation not found",
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to convert quotation to invoice",
          cause: error,
        });
      }
    }),
});
