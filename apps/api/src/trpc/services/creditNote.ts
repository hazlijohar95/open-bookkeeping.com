import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { creditNoteBusiness } from "../../services/business";
import { db, invoices } from "@open-bookkeeping/db";
import { eq, and } from "drizzle-orm";
import {
  paginationSchema,
  billingDetailSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
  themeSchema,
  noteReasonSchema,
} from "../../schemas/common";

const createCreditNoteSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  reason: noteReasonSchema,
  reasonDescription: z.string().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  creditNoteDetails: z.object({
    theme: themeSchema.optional(),
    currency: z.string(),
    prefix: z.string().default("CN-"),
    serialNumber: z.string(),
    date: z.date(),
    originalInvoiceNumber: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(documentItemSchema),
  metadata: z
    .object({
      notes: z.string().optional(),
      terms: z.string().optional(),
    })
    .optional(),
});

export const creditNoteRouter = router({
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input ?? {};

      return creditNoteBusiness.list(
        { userId: ctx.user.id },
        { limit, offset }
      );
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const creditNote = await creditNoteBusiness.getById(
        { userId: ctx.user.id },
        input.id
      );

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        });
      }

      return creditNote;
    }),

  insert: protectedProcedure
    .input(createCreditNoteSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Transform billingDetails to ensure value is string | number
        const creditNoteDetails = {
          ...input.creditNoteDetails,
          billingDetails: input.creditNoteDetails.billingDetails?.map((bd) => ({
            label: bd.label,
            type: bd.type as "fixed" | "percentage",
            value: bd.value,
          })),
        };

        return await creditNoteBusiness.create(
          {
            userId: ctx.user.id,
            allowedSavingData: ctx.user.allowedSavingData,
          },
          {
            invoiceId: input.invoiceId,
            customerId: input.customerId,
            vendorId: input.vendorId,
            reason: input.reason,
            reasonDescription: input.reasonDescription,
            companyDetails: input.companyDetails,
            clientDetails: input.clientDetails,
            creditNoteDetails,
            items: input.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
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
          message: "Failed to create credit note",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await creditNoteBusiness.delete(
          { userId: ctx.user.id },
          input.id
        );

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Credit note not found",
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

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["draft", "issued", "applied", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await creditNoteBusiness.updateStatus(
        { userId: ctx.user.id },
        input.id,
        input.status
      );

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        });
      }

      return result;
    }),

  createFromInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        reason: z.enum([
          "return",
          "discount",
          "pricing_error",
          "damaged_goods",
          "other",
        ]),
        reasonDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have disabled data saving",
        });
      }

      // Fetch the invoice with all related data
      const invoice = await db.query.invoices.findFirst({
        where: and(
          eq(invoices.id, input.invoiceId),
          eq(invoices.userId, ctx.user.id)
        ),
        with: {
          invoiceFields: {
            with: {
              companyDetails: {
                with: { metadata: true },
              },
              clientDetails: {
                with: { metadata: true },
              },
              invoiceDetails: {
                with: { billingDetails: true },
              },
              items: true,
              metadata: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      if (!invoice.invoiceFields) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invoice data is incomplete",
        });
      }

      const invf = invoice.invoiceFields;
      const originalInvoiceNumber = invf.invoiceDetails
        ? `${invf.invoiceDetails.prefix}${invf.invoiceDetails.serialNumber}`
        : undefined;

      try {
        // Create credit note from invoice data using business service
        const result = await creditNoteBusiness.create(
          {
            userId: ctx.user.id,
            allowedSavingData: ctx.user.allowedSavingData,
          },
          {
            invoiceId: input.invoiceId,
            customerId: invoice.customerId ?? undefined,
            vendorId: invoice.vendorId ?? undefined,
            reason: input.reason,
            reasonDescription: input.reasonDescription,
            companyDetails: {
              name: invf.companyDetails?.name ?? "",
              address: invf.companyDetails?.address ?? "",
              logo: invf.companyDetails?.logo,
              signature: invf.companyDetails?.signature,
              metadata: invf.companyDetails?.metadata?.map((m) => ({
                label: m.label,
                value: m.value,
              })),
            },
            clientDetails: {
              name: invf.clientDetails?.name ?? "",
              address: invf.clientDetails?.address ?? "",
              metadata: invf.clientDetails?.metadata?.map((m) => ({
                label: m.label,
                value: m.value,
              })),
            },
            creditNoteDetails: {
              theme: invf.invoiceDetails?.theme as
                | {
                    baseColor: string;
                    mode: "dark" | "light";
                    template?:
                      | "default"
                      | "cynco"
                      | "classic"
                      | "zen"
                      | "executive";
                  }
                | undefined,
              currency: invf.invoiceDetails?.currency ?? "MYR",
              prefix: "CN-",
              serialNumber: `${Date.now()}`,
              date: new Date(),
              originalInvoiceNumber,
              billingDetails: invf.invoiceDetails?.billingDetails?.map((b) => ({
                label: b.label,
                type: b.type as "fixed" | "percentage",
                value: b.value,
              })),
            },
            items:
              invf.items?.map((item) => ({
                name: item.name,
                description: item.description ?? undefined,
                quantity: item.quantity,
                unitPrice: parseFloat(item.unitPrice),
              })) ?? [],
            metadata: invf.metadata
              ? {
                  notes: invf.metadata.notes ?? undefined,
                  terms: invf.metadata.terms ?? undefined,
                }
              : undefined,
          }
        );

        return { creditNoteId: result.creditNoteId, invoiceId: invoice.id };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create credit note from invoice",
          cause: error,
        });
      }
    }),
});
