import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  db,
  creditNotes,
  creditNoteFields,
  creditNoteCompanyDetails,
  creditNoteCompanyDetailsMetadata,
  creditNoteClientDetails,
  creditNoteClientDetailsMetadata,
  creditNoteDetails,
  creditNoteDetailsBillingDetails,
  creditNoteItems,
  creditNoteMetadata,
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

const logger = createLogger("credit-note-service");

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
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
  }).optional(),
});

export const creditNoteRouter = router({
  list: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const { limit = 50, offset = 0 } = input || {};

      const userCreditNotes = await db.query.creditNotes.findMany({
        where: eq(creditNotes.userId, ctx.user.id),
        with: {
          invoice: true,
          customer: true,
          vendor: true,
          creditNoteFields: {
            with: {
              companyDetails: true,
              clientDetails: true,
              creditNoteDetails: true,
              items: true,
              metadata: true,
            },
          },
        },
        limit,
        offset,
        orderBy: (creditNotes, { desc }) => [desc(creditNotes.createdAt)],
      });

      return userCreditNotes.map((creditNote) => ({
        ...creditNote,
        creditNoteFields: creditNote.creditNoteFields
          ? {
              companyDetails: creditNote.creditNoteFields.companyDetails,
              clientDetails: creditNote.creditNoteFields.clientDetails,
              creditNoteDetails: creditNote.creditNoteFields.creditNoteDetails,
              items: creditNote.creditNoteFields.items,
              metadata: creditNote.creditNoteFields.metadata,
            }
          : null,
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const creditNote = await db.query.creditNotes.findFirst({
        where: and(
          eq(creditNotes.id, input.id),
          eq(creditNotes.userId, ctx.user.id)
        ),
        with: {
          invoice: true,
          customer: true,
          vendor: true,
          creditNoteFields: {
            with: {
              companyDetails: {
                with: { metadata: true },
              },
              clientDetails: {
                with: { metadata: true },
              },
              creditNoteDetails: {
                with: { billingDetails: true },
              },
              items: true,
              metadata: true,
            },
          },
        },
      });

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
      if (!ctx.user.allowedSavingData) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have disabled data saving",
        });
      }

      try {
        const result = await db.transaction(async (tx) => {
          // Create credit note
          const [creditNote] = await tx
            .insert(creditNotes)
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

          // Create credit note fields
          const [field] = await tx
            .insert(creditNoteFields)
            .values({ creditNoteId: creditNote!.id })
            .returning();

          // Create company details
          const [companyDetail] = await tx
            .insert(creditNoteCompanyDetails)
            .values({
              creditNoteFieldId: field!.id,
              name: input.companyDetails.name,
              address: input.companyDetails.address,
              logo: input.companyDetails.logo,
              signature: input.companyDetails.signature,
            })
            .returning();

          // Create company metadata
          if (input.companyDetails.metadata?.length) {
            await tx.insert(creditNoteCompanyDetailsMetadata).values(
              input.companyDetails.metadata.map((m) => ({
                creditNoteCompanyDetailsId: companyDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create client details
          const [clientDetail] = await tx
            .insert(creditNoteClientDetails)
            .values({
              creditNoteFieldId: field!.id,
              name: input.clientDetails.name,
              address: input.clientDetails.address,
            })
            .returning();

          // Create client metadata
          if (input.clientDetails.metadata?.length) {
            await tx.insert(creditNoteClientDetailsMetadata).values(
              input.clientDetails.metadata.map((m) => ({
                creditNoteClientDetailsId: clientDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create credit note details
          const [detail] = await tx
            .insert(creditNoteDetails)
            .values({
              creditNoteFieldId: field!.id,
              theme: input.creditNoteDetails.theme,
              currency: input.creditNoteDetails.currency,
              prefix: input.creditNoteDetails.prefix,
              serialNumber: input.creditNoteDetails.serialNumber,
              date: input.creditNoteDetails.date,
              originalInvoiceNumber: input.creditNoteDetails.originalInvoiceNumber,
            })
            .returning();

          // Create billing details
          if (input.creditNoteDetails.billingDetails?.length) {
            await tx.insert(creditNoteDetailsBillingDetails).values(
              input.creditNoteDetails.billingDetails.map((b) => ({
                creditNoteDetailsId: detail!.id,
                label: b.label,
                type: b.type,
                value: String(b.value),
              }))
            );
          }

          // Create items
          if (input.items.length) {
            await tx.insert(creditNoteItems).values(
              input.items.map((item) => ({
                creditNoteFieldId: field!.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: String(item.unitPrice),
              }))
            );
          }

          // Create metadata
          if (input.metadata) {
            await tx.insert(creditNoteMetadata).values({
              creditNoteFieldId: field!.id,
              notes: input.metadata.notes,
              terms: input.metadata.terms,
            });
          }

          return { creditNoteId: creditNote!.id };
        });

        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id }, "Failed to create credit note");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create credit note",
          cause: error,
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createCreditNoteSchema,
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
      const existing = await db.query.creditNotes.findFirst({
        where: and(
          eq(creditNotes.id, input.id),
          eq(creditNotes.userId, ctx.user.id)
        ),
        with: { creditNoteFields: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        });
      }

      try {
        const result = await db.transaction(async (tx) => {
          // Delete existing fields (cascade will handle nested)
          if (existing.creditNoteFields) {
            await tx
              .delete(creditNoteFields)
              .where(eq(creditNoteFields.id, existing.creditNoteFields.id));
          }

          // Update credit note record
          await tx
            .update(creditNotes)
            .set({
              reason: input.data.reason,
              reasonDescription: input.data.reasonDescription,
              updatedAt: new Date(),
            })
            .where(eq(creditNotes.id, input.id));

          // Create new credit note fields
          const [field] = await tx
            .insert(creditNoteFields)
            .values({ creditNoteId: input.id })
            .returning();

          // Create company details
          const [companyDetail] = await tx
            .insert(creditNoteCompanyDetails)
            .values({
              creditNoteFieldId: field!.id,
              name: input.data.companyDetails.name,
              address: input.data.companyDetails.address,
              logo: input.data.companyDetails.logo,
              signature: input.data.companyDetails.signature,
            })
            .returning();

          // Create company metadata
          if (input.data.companyDetails.metadata?.length) {
            await tx.insert(creditNoteCompanyDetailsMetadata).values(
              input.data.companyDetails.metadata.map((m) => ({
                creditNoteCompanyDetailsId: companyDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create client details
          const [clientDetail] = await tx
            .insert(creditNoteClientDetails)
            .values({
              creditNoteFieldId: field!.id,
              name: input.data.clientDetails.name,
              address: input.data.clientDetails.address,
            })
            .returning();

          // Create client metadata
          if (input.data.clientDetails.metadata?.length) {
            await tx.insert(creditNoteClientDetailsMetadata).values(
              input.data.clientDetails.metadata.map((m) => ({
                creditNoteClientDetailsId: clientDetail!.id,
                label: m.label,
                value: m.value,
              }))
            );
          }

          // Create credit note details
          const [detail] = await tx
            .insert(creditNoteDetails)
            .values({
              creditNoteFieldId: field!.id,
              theme: input.data.creditNoteDetails.theme,
              currency: input.data.creditNoteDetails.currency,
              prefix: input.data.creditNoteDetails.prefix,
              serialNumber: input.data.creditNoteDetails.serialNumber,
              date: input.data.creditNoteDetails.date,
              originalInvoiceNumber: input.data.creditNoteDetails.originalInvoiceNumber,
            })
            .returning();

          // Create billing details
          if (input.data.creditNoteDetails.billingDetails?.length) {
            await tx.insert(creditNoteDetailsBillingDetails).values(
              input.data.creditNoteDetails.billingDetails.map((b) => ({
                creditNoteDetailsId: detail!.id,
                label: b.label,
                type: b.type,
                value: String(b.value),
              }))
            );
          }

          // Create items
          if (input.data.items.length) {
            await tx.insert(creditNoteItems).values(
              input.data.items.map((item) => ({
                creditNoteFieldId: field!.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: String(item.unitPrice),
              }))
            );
          }

          // Create metadata
          if (input.data.metadata) {
            await tx.insert(creditNoteMetadata).values({
              creditNoteFieldId: field!.id,
              notes: input.data.metadata.notes,
              terms: input.data.metadata.terms,
            });
          }

          return { creditNoteId: input.id };
        });

        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id, creditNoteId: input.id }, "Failed to update credit note");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update credit note",
          cause: error,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const creditNote = await db.query.creditNotes.findFirst({
        where: and(
          eq(creditNotes.id, input.id),
          eq(creditNotes.userId, ctx.user.id)
        ),
      });

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        });
      }

      // Only allow deletion of draft credit notes
      if (creditNote.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft credit notes can be deleted",
        });
      }

      await db.delete(creditNotes).where(eq(creditNotes.id, input.id));

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
      const creditNote = await db.query.creditNotes.findFirst({
        where: and(
          eq(creditNotes.id, input.id),
          eq(creditNotes.userId, ctx.user.id)
        ),
      });

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        });
      }

      await db
        .update(creditNotes)
        .set({
          status: input.status,
          issuedAt: input.status === "issued" ? new Date() : creditNote.issuedAt,
          updatedAt: new Date(),
        })
        .where(eq(creditNotes.id, input.id));

      // Create journal entry when credit note is issued (non-blocking)
      if (input.status === "issued") {
        // Fetch full credit note data for journal entry
        const fullCreditNote = await db.query.creditNotes.findFirst({
          where: eq(creditNotes.id, input.id),
          with: {
            creditNoteFields: {
              with: {
                clientDetails: true,
                creditNoteDetails: {
                  with: { billingDetails: true },
                },
                items: true,
              },
            },
          },
        });

        if (fullCreditNote?.creditNoteFields) {
          const fields = fullCreditNote.creditNoteFields;
          const details = fields.creditNoteDetails;
          const items = fields.items || [];
          const billingDetails = details?.billingDetails || [];

          // Create journal entry in background (don't block the response)
          journalEntryIntegration.createCreditNoteJournalEntry(ctx.user.id, {
            id: fullCreditNote.id,
            serialNumber: `${details?.prefix || "CN-"}${details?.serialNumber || ""}`,
            date: details?.date || new Date(),
            reason: fullCreditNote.reason || "adjustment",
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
              logger.info({ creditNoteId: input.id, entryId: result.entryId }, "Credit note journal entry created");
            } else {
              logger.warn({ creditNoteId: input.id, error: result.error }, "Failed to create credit note journal entry");
            }
          }).catch((err) => {
            logger.error({ err, creditNoteId: input.id }, "Error creating credit note journal entry");
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
          // Create credit note from invoice data
          const [creditNote] = await tx
            .insert(creditNotes)
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

          // Create credit note fields
          const [creditNoteField] = await tx
            .insert(creditNoteFields)
            .values({ creditNoteId: creditNote!.id })
            .returning();

          // Copy company details
          if (invf.companyDetails) {
            const [companyDetail] = await tx
              .insert(creditNoteCompanyDetails)
              .values({
                creditNoteFieldId: creditNoteField!.id,
                name: invf.companyDetails.name,
                address: invf.companyDetails.address,
                logo: invf.companyDetails.logo,
                signature: invf.companyDetails.signature,
              })
              .returning();

            if (invf.companyDetails.metadata?.length) {
              await tx.insert(creditNoteCompanyDetailsMetadata).values(
                invf.companyDetails.metadata.map((m) => ({
                  creditNoteCompanyDetailsId: companyDetail!.id,
                  label: m.label,
                  value: m.value,
                }))
              );
            }
          }

          // Copy client details
          if (invf.clientDetails) {
            const [clientDetail] = await tx
              .insert(creditNoteClientDetails)
              .values({
                creditNoteFieldId: creditNoteField!.id,
                name: invf.clientDetails.name,
                address: invf.clientDetails.address,
              })
              .returning();

            if (invf.clientDetails.metadata?.length) {
              await tx.insert(creditNoteClientDetailsMetadata).values(
                invf.clientDetails.metadata.map((m) => ({
                  creditNoteClientDetailsId: clientDetail!.id,
                  label: m.label,
                  value: m.value,
                }))
              );
            }
          }

          // Copy invoice details to credit note details
          if (invf.invoiceDetails) {
            const originalInvoiceNumber = `${invf.invoiceDetails.prefix}${invf.invoiceDetails.serialNumber}`;
            const [detail] = await tx
              .insert(creditNoteDetails)
              .values({
                creditNoteFieldId: creditNoteField!.id,
                theme: invf.invoiceDetails.theme,
                currency: invf.invoiceDetails.currency,
                prefix: "CN-",
                serialNumber: `${Date.now()}`, // Generate new serial number
                date: new Date(),
                originalInvoiceNumber,
              })
              .returning();

            if (invf.invoiceDetails.billingDetails?.length) {
              await tx.insert(creditNoteDetailsBillingDetails).values(
                invf.invoiceDetails.billingDetails.map((b) => ({
                  creditNoteDetailsId: detail!.id,
                  label: b.label,
                  type: b.type,
                  value: b.value,
                }))
              );
            }
          }

          // Copy items
          if (invf.items?.length) {
            await tx.insert(creditNoteItems).values(
              invf.items.map((item) => ({
                creditNoteFieldId: creditNoteField!.id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            );
          }

          // Copy metadata (notes, terms - but not payment information for credit notes)
          if (invf.metadata) {
            await tx.insert(creditNoteMetadata).values({
              creditNoteFieldId: creditNoteField!.id,
              notes: invf.metadata.notes,
              terms: invf.metadata.terms,
            });
          }

          return { creditNoteId: creditNote!.id, invoiceId: invoice!.id };
        });

        return result;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id, invoiceId: input.invoiceId }, "Failed to create credit note from invoice");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create credit note from invoice",
          cause: error,
        });
      }
    }),
});
