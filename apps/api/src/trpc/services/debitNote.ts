import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  db,
  debitNotes,
  debitNoteFields,
  debitNoteCompanyDetails,
  debitNoteCompanyDetailsMetadata,
  debitNoteClientDetails,
  debitNoteClientDetailsMetadata,
  debitNoteDetails,
  debitNoteDetailsBillingDetails,
  debitNoteItems,
  debitNoteMetadata,
  invoices,
} from "@open-bookkeeping/db";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";
import { journalEntryIntegration } from "../../services/journalEntry.integration";
import {
  paginationSchema,
  billingDetailSchema,
  documentItemSchema,
  companyDetailsSchema,
  clientDetailsSchema,
  themeSchema,
  noteReasonSchema,
} from "../../schemas/common";

const logger = createLogger("debit-note-service");

const createDebitNoteSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  reason: noteReasonSchema,
  reasonDescription: z.string().optional(),
  companyDetails: companyDetailsSchema,
  clientDetails: clientDetailsSchema,
  debitNoteDetails: z.object({
    theme: themeSchema.optional(),
    currency: z.string(),
    prefix: z.string().default("DN-"),
    serialNumber: z.string(),
    date: z.date(),
    originalInvoiceNumber: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(documentItemSchema),
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
  }).optional(),
});

export const debitNoteRouter = router({
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input || {};

      const userDebitNotes = await db.query.debitNotes.findMany({
        where: eq(debitNotes.userId, ctx.user.id),
        with: {
          invoice: true,
          customer: true,
          vendor: true,
          debitNoteFields: {
            with: {
              companyDetails: true,
              clientDetails: true,
              debitNoteDetails: true,
              items: true,
              metadata: true,
            },
          },
        },
        limit,
        offset,
        orderBy: (debitNotes, { desc }) => [desc(debitNotes.createdAt)],
      });

      return userDebitNotes.map((debitNote) => ({
        ...debitNote,
        debitNoteFields: debitNote.debitNoteFields
          ? {
              companyDetails: debitNote.debitNoteFields.companyDetails,
              clientDetails: debitNote.debitNoteFields.clientDetails,
              debitNoteDetails: debitNote.debitNoteFields.debitNoteDetails,
              items: debitNote.debitNoteFields.items,
              metadata: debitNote.debitNoteFields.metadata,
            }
          : null,
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const debitNote = await db.query.debitNotes.findFirst({
        where: and(
          eq(debitNotes.id, input.id),
          eq(debitNotes.userId, ctx.user.id)
        ),
        with: {
          invoice: true,
          customer: true,
          vendor: true,
          debitNoteFields: {
            with: {
              companyDetails: {
                with: { metadata: true },
              },
              clientDetails: {
                with: { metadata: true },
              },
              debitNoteDetails: {
                with: { billingDetails: true },
              },
              items: true,
              metadata: true,
            },
          },
        },
      });

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        });
      }

      return debitNote;
    }),

  insert: protectedProcedure
    .input(createDebitNoteSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have disabled data saving",
        });
      }

      try {
        const result = await db.transaction(async (tx) => {
          // Create debit note
          const [debitNote] = await tx
            .insert(debitNotes)
            .values({
              userId: ctx.user.id,
              invoiceId: input.invoiceId,
              customerId: input.customerId,
              vendorId: input.vendorId,
              type: "server",
              status: "draft",
              reason: input.reason,
              reasonDescription: input.reasonDescription,
            })
            .returning();

          // Create debit note fields
          const [field] = await tx
            .insert(debitNoteFields)
            .values({ debitNoteId: debitNote!.id })
            .returning();

          // Create company details
          const [companyDetail] = await tx
            .insert(debitNoteCompanyDetails)
            .values({
              debitNoteFieldId: field!.id,
              name: input.companyDetails.name,
              address: input.companyDetails.address,
              logo: input.companyDetails.logo,
              signature: input.companyDetails.signature,
            })
            .returning();

          // Create company metadata
          if (input.companyDetails.metadata?.length) {
            await tx.insert(debitNoteCompanyDetailsMetadata).values(
              input.companyDetails.metadata.map((m) => ({
                debitNoteCompanyDetailsId: companyDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create client details
          const [clientDetail] = await tx
            .insert(debitNoteClientDetails)
            .values({
              debitNoteFieldId: field!.id,
              name: input.clientDetails.name,
              address: input.clientDetails.address,
            })
            .returning();

          // Create client metadata
          if (input.clientDetails.metadata?.length) {
            await tx.insert(debitNoteClientDetailsMetadata).values(
              input.clientDetails.metadata.map((m) => ({
                debitNoteClientDetailsId: clientDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create debit note details
          const [detail] = await tx
            .insert(debitNoteDetails)
            .values({
              debitNoteFieldId: field!.id,
              theme: input.debitNoteDetails.theme,
              currency: input.debitNoteDetails.currency,
              prefix: input.debitNoteDetails.prefix,
              serialNumber: input.debitNoteDetails.serialNumber,
              date: input.debitNoteDetails.date,
              originalInvoiceNumber: input.debitNoteDetails.originalInvoiceNumber,
            })
            .returning();

          // Create billing details
          if (input.debitNoteDetails.billingDetails?.length) {
            await tx.insert(debitNoteDetailsBillingDetails).values(
              input.debitNoteDetails.billingDetails.map((b) => ({
                debitNoteDetailsId: detail!.id,
                label: b.label,
                type: b.type,
                value: String(b.value),
              }))
            );
          }

          // Create items
          if (input.items.length) {
            await tx.insert(debitNoteItems).values(
              input.items.map((item) => ({
                debitNoteFieldId: field!.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: String(item.unitPrice),
              }))
            );
          }

          // Create metadata
          if (input.metadata) {
            await tx.insert(debitNoteMetadata).values({
              debitNoteFieldId: field!.id,
              notes: input.metadata.notes,
              terms: input.metadata.terms,
            });
          }

          return { debitNoteId: debitNote!.id };
        });

        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id }, "Failed to create debit note");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create debit note",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createDebitNoteSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.allowedSavingData) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have disabled data saving",
        });
      }

      // Verify ownership
      const existing = await db.query.debitNotes.findFirst({
        where: and(
          eq(debitNotes.id, input.id),
          eq(debitNotes.userId, ctx.user.id)
        ),
        with: { debitNoteFields: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        });
      }

      try {
        const result = await db.transaction(async (tx) => {
          // Delete existing fields (cascade will handle nested)
          if (existing.debitNoteFields) {
            await tx
              .delete(debitNoteFields)
              .where(eq(debitNoteFields.id, existing.debitNoteFields.id));
          }

          // Update debit note record
          await tx
            .update(debitNotes)
            .set({
              reason: input.data.reason,
              reasonDescription: input.data.reasonDescription,
              updatedAt: new Date(),
            })
            .where(eq(debitNotes.id, input.id));

          // Create new debit note fields
          const [field] = await tx
            .insert(debitNoteFields)
            .values({ debitNoteId: input.id })
            .returning();

          // Create company details
          const [companyDetail] = await tx
            .insert(debitNoteCompanyDetails)
            .values({
              debitNoteFieldId: field!.id,
              name: input.data.companyDetails.name,
              address: input.data.companyDetails.address,
              logo: input.data.companyDetails.logo,
              signature: input.data.companyDetails.signature,
            })
            .returning();

          // Create company metadata
          if (input.data.companyDetails.metadata?.length) {
            await tx.insert(debitNoteCompanyDetailsMetadata).values(
              input.data.companyDetails.metadata.map((m) => ({
                debitNoteCompanyDetailsId: companyDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create client details
          const [clientDetail] = await tx
            .insert(debitNoteClientDetails)
            .values({
              debitNoteFieldId: field!.id,
              name: input.data.clientDetails.name,
              address: input.data.clientDetails.address,
            })
            .returning();

          // Create client metadata
          if (input.data.clientDetails.metadata?.length) {
            await tx.insert(debitNoteClientDetailsMetadata).values(
              input.data.clientDetails.metadata.map((m) => ({
                debitNoteClientDetailsId: clientDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create debit note details
          const [detail] = await tx
            .insert(debitNoteDetails)
            .values({
              debitNoteFieldId: field!.id,
              theme: input.data.debitNoteDetails.theme,
              currency: input.data.debitNoteDetails.currency,
              prefix: input.data.debitNoteDetails.prefix,
              serialNumber: input.data.debitNoteDetails.serialNumber,
              date: input.data.debitNoteDetails.date,
              originalInvoiceNumber: input.data.debitNoteDetails.originalInvoiceNumber,
            })
            .returning();

          // Create billing details
          if (input.data.debitNoteDetails.billingDetails?.length) {
            await tx.insert(debitNoteDetailsBillingDetails).values(
              input.data.debitNoteDetails.billingDetails.map((b) => ({
                debitNoteDetailsId: detail!.id,
                label: b.label,
                type: b.type,
                value: String(b.value),
              }))
            );
          }

          // Create items
          if (input.data.items.length) {
            await tx.insert(debitNoteItems).values(
              input.data.items.map((item) => ({
                debitNoteFieldId: field!.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: String(item.unitPrice),
              }))
            );
          }

          // Create metadata
          if (input.data.metadata) {
            await tx.insert(debitNoteMetadata).values({
              debitNoteFieldId: field!.id,
              notes: input.data.metadata.notes,
              terms: input.data.metadata.terms,
            });
          }

          return { debitNoteId: input.id };
        });

        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id, debitNoteId: input.id }, "Failed to update debit note");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update debit note",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const debitNote = await db.query.debitNotes.findFirst({
        where: and(
          eq(debitNotes.id, input.id),
          eq(debitNotes.userId, ctx.user.id)
        ),
      });

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        });
      }

      // Only allow deletion of draft debit notes
      if (debitNote.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft debit notes can be deleted",
        });
      }

      await db.delete(debitNotes).where(eq(debitNotes.id, input.id));

      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["draft", "issued", "applied", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const debitNote = await db.query.debitNotes.findFirst({
        where: and(
          eq(debitNotes.id, input.id),
          eq(debitNotes.userId, ctx.user.id)
        ),
      });

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        });
      }

      await db
        .update(debitNotes)
        .set({
          status: input.status,
          issuedAt: input.status === "issued" ? new Date() : debitNote.issuedAt,
          updatedAt: new Date(),
        })
        .where(eq(debitNotes.id, input.id));

      // Create journal entry when debit note is issued (non-blocking)
      if (input.status === "issued") {
        // Fetch full debit note data for journal entry
        const fullDebitNote = await db.query.debitNotes.findFirst({
          where: eq(debitNotes.id, input.id),
          with: {
            debitNoteFields: {
              with: {
                clientDetails: true,
                debitNoteDetails: {
                  with: { billingDetails: true },
                },
                items: true,
              },
            },
          },
        });

        if (fullDebitNote?.debitNoteFields) {
          const fields = fullDebitNote.debitNoteFields;
          const details = fields.debitNoteDetails;
          const items = fields.items || [];
          const billingDetails = details?.billingDetails || [];

          // Create journal entry in background (don't block the response)
          journalEntryIntegration.createDebitNoteJournalEntry(ctx.user.id, {
            id: fullDebitNote.id,
            serialNumber: `${details?.prefix || "DN-"}${details?.serialNumber || ""}`,
            date: details?.date || new Date(),
            reason: fullDebitNote.reason || "adjustment",
            items: items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: parseFloat(item.unitPrice),
            })),
            billingDetails: billingDetails.map((b) => ({
              label: b.label,
              type: b.type as "fixed" | "percentage",
              value: parseFloat(b.value),
              isSstTax: b.label.toLowerCase().includes("sst") || b.label.toLowerCase().includes("tax"),
            })),
            clientDetails: {
              name: fields.clientDetails?.name || "Customer",
            },
            originalInvoiceNumber: details?.originalInvoiceNumber || undefined,
          }).then((result) => {
            if (result.success) {
              logger.info({ debitNoteId: input.id, entryId: result.entryId }, "Debit note journal entry created");
            } else {
              logger.warn({ debitNoteId: input.id, error: result.error }, "Failed to create debit note journal entry");
            }
          }).catch((err) => {
            logger.error({ err, debitNoteId: input.id }, "Error creating debit note journal entry");
          });
        }
      }

      return { success: true };
    }),

  createFromInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        reason: z.enum(["return", "discount", "pricing_error", "damaged_goods", "other"]),
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

      try {
        const result = await db.transaction(async (tx) => {
          // Create debit note from invoice data
          const [debitNote] = await tx
            .insert(debitNotes)
            .values({
              userId: ctx.user.id,
              invoiceId: input.invoiceId,
              customerId: invoice.customerId,
              vendorId: invoice.vendorId,
              type: "server",
              status: "draft",
              reason: input.reason,
              reasonDescription: input.reasonDescription,
            })
            .returning();

          // Create debit note fields
          const [debitNoteField] = await tx
            .insert(debitNoteFields)
            .values({ debitNoteId: debitNote!.id })
            .returning();

          // Copy company details
          if (invf.companyDetails) {
            const [companyDetail] = await tx
              .insert(debitNoteCompanyDetails)
              .values({
                debitNoteFieldId: debitNoteField!.id,
                name: invf.companyDetails.name,
                address: invf.companyDetails.address,
                logo: invf.companyDetails.logo,
                signature: invf.companyDetails.signature,
              })
              .returning();

            if (invf.companyDetails.metadata?.length) {
              await tx.insert(debitNoteCompanyDetailsMetadata).values(
                invf.companyDetails.metadata.map((m) => ({
                  debitNoteCompanyDetailsId: companyDetail!.id,
                  label: m.label,
                  value: m.value,
                }))
              );
            }
          }

          // Copy client details
          if (invf.clientDetails) {
            const [clientDetail] = await tx
              .insert(debitNoteClientDetails)
              .values({
                debitNoteFieldId: debitNoteField!.id,
                name: invf.clientDetails.name,
                address: invf.clientDetails.address,
              })
              .returning();

            if (invf.clientDetails.metadata?.length) {
              await tx.insert(debitNoteClientDetailsMetadata).values(
                invf.clientDetails.metadata.map((m) => ({
                  debitNoteClientDetailsId: clientDetail!.id,
                  label: m.label,
                  value: m.value,
                }))
              );
            }
          }

          // Copy invoice details to debit note details
          if (invf.invoiceDetails) {
            const originalInvoiceNumber = `${invf.invoiceDetails.prefix}${invf.invoiceDetails.serialNumber}`;
            const [detail] = await tx
              .insert(debitNoteDetails)
              .values({
                debitNoteFieldId: debitNoteField!.id,
                theme: invf.invoiceDetails.theme,
                currency: invf.invoiceDetails.currency,
                prefix: "DN-",
                serialNumber: `${Date.now()}`, // Generate new serial number
                date: new Date(),
                originalInvoiceNumber,
              })
              .returning();

            if (invf.invoiceDetails.billingDetails?.length) {
              await tx.insert(debitNoteDetailsBillingDetails).values(
                invf.invoiceDetails.billingDetails.map((b) => ({
                  debitNoteDetailsId: detail!.id,
                  label: b.label,
                  type: b.type,
                  value: b.value,
                }))
              );
            }
          }

          // Copy items
          if (invf.items?.length) {
            await tx.insert(debitNoteItems).values(
              invf.items.map((item) => ({
                debitNoteFieldId: debitNoteField!.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            );
          }

          // Copy metadata (notes, terms - but not payment information for debit notes)
          if (invf.metadata) {
            await tx.insert(debitNoteMetadata).values({
              debitNoteFieldId: debitNoteField!.id,
              notes: invf.metadata.notes,
              terms: invf.metadata.terms,
            });
          }

          return { debitNoteId: debitNote!.id, invoiceId: invoice!.id };
        });

        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id, invoiceId: input.invoiceId }, "Failed to create debit note from invoice");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create debit note from invoice",
          cause: error,
        });
      }
    }),
});
