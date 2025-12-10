import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  einvoiceRepository,
  invoiceRepository,
  type EInvoiceSubmissionStatus,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import {
  getGatewayClient,
  MyInvoisGatewayError,
} from "../../services/myinvois-gateway";
import {
  transformInvoiceToMyInvois,
  transformToCreditNote,
  transformToDebitNote,
  validateInvoiceForEInvoice,
  validateEInvoiceSettings,
  type EInvoiceSettings,
  type CustomerEInvoiceDetails,
} from "../../services/einvoice-transformer";

const logger = createLogger("einvoice-service");

// Valid submission statuses for type safety
const validSubmissionStatuses = ["pending", "submitted", "valid", "invalid", "cancelled"] as const;

/**
 * Maps MyInvois API status to our database enum
 * MyInvois returns status in uppercase (e.g., "VALID", "INVALID")
 */
function mapMyInvoisStatus(apiStatus: string): EInvoiceSubmissionStatus | null {
  const normalizedStatus = apiStatus.toLowerCase();
  if (validSubmissionStatuses.includes(normalizedStatus as typeof validSubmissionStatuses[number])) {
    return normalizedStatus as EInvoiceSubmissionStatus;
  }
  return null;
}

// ============================================
// ZOD SCHEMAS
// ============================================

const identificationSchemeSchema = z.enum(["NRIC", "BRN", "PASSPORT", "ARMY"]);

const einvoiceSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoSubmit: z.boolean().optional(),
  tin: z.string().min(1).max(20).optional(),
  brn: z.string().min(1).max(30).optional(),
  identificationScheme: identificationSchemeSchema.optional(),
  msicCode: z.string().length(5).optional(),
  msicDescription: z.string().min(1).max(255).optional(),
  sstRegistration: z.string().max(50).nullable().optional(),
  tourismTaxRegistration: z.string().max(50).nullable().optional(),
});

const customerEInvoiceDetailsSchema = z.object({
  tin: z.string().optional(),
  brn: z.string().optional(),
  identificationScheme: identificationSchemeSchema.optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
}).optional();

const submitInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  customerDetails: customerEInvoiceDetailsSchema,
  dryRun: z.boolean().optional(),
});

const submitCreditNoteSchema = z.object({
  invoiceId: z.string().uuid(), // The credit note invoice ID
  originalInvoiceRef: z.object({
    id: z.string(), // Original invoice number
    uuid: z.string().optional(), // MyInvois UUID if available
    issueDate: z.string().optional(),
  }),
  customerDetails: customerEInvoiceDetailsSchema,
  dryRun: z.boolean().optional(),
});

const submitDebitNoteSchema = z.object({
  invoiceId: z.string().uuid(), // The debit note invoice ID
  originalInvoiceRef: z.object({
    id: z.string(), // Original invoice number
    uuid: z.string().optional(), // MyInvois UUID if available
    issueDate: z.string().optional(),
  }),
  customerDetails: customerEInvoiceDetailsSchema,
  dryRun: z.boolean().optional(),
});

const cancelDocumentSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

const bulkSubmitSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(100),
  dryRun: z.boolean().optional(),
});

// ============================================
// ROUTER
// ============================================

export const einvoiceRouter = router({
  // ============================================
  // SETTINGS
  // ============================================

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await einvoiceRepository.getSettings(ctx.user.id);

    return settings || {
      enabled: false,
      autoSubmit: false,
      tin: null,
      brn: null,
      identificationScheme: null,
      msicCode: null,
      msicDescription: null,
      sstRegistration: null,
      tourismTaxRegistration: null,
    };
  }),

  updateSettings: protectedProcedure
    .input(einvoiceSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const settings = await einvoiceRepository.upsertSettings(ctx.user.id, input);

        logger.info(
          { userId: ctx.user.id, enabled: input.enabled },
          "E-invoice settings updated"
        );

        return settings;
      } catch (error) {
        logger.error({ err: error, userId: ctx.user.id }, "Failed to update e-invoice settings");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update e-invoice settings",
          cause: error,
        });
      }
    }),

  validateSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await einvoiceRepository.getSettings(ctx.user.id);

    if (!settings) {
      return {
        valid: false,
        errors: ["E-invoice settings not configured"],
      };
    }

    return validateEInvoiceSettings({
      tin: settings.tin || undefined,
      brn: settings.brn || undefined,
      identificationScheme: settings.identificationScheme || undefined,
      msicCode: settings.msicCode || undefined,
      msicDescription: settings.msicDescription || undefined,
    });
  }),

  // ============================================
  // SUBMISSION
  // ============================================

  submitInvoice: protectedProcedure
    .input(submitInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Get settings
      const settings = await einvoiceRepository.getSettings(ctx.user.id);

      if (!settings || !settings.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "E-invoice is not enabled. Please configure your settings first.",
        });
      }

      // Validate settings
      const settingsValidation = validateEInvoiceSettings({
        tin: settings.tin || undefined,
        brn: settings.brn || undefined,
        identificationScheme: settings.identificationScheme || undefined,
        msicCode: settings.msicCode || undefined,
        msicDescription: settings.msicDescription || undefined,
      });

      if (!settingsValidation.valid) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Invalid e-invoice settings: ${settingsValidation.errors.join(", ")}`,
        });
      }

      // 2. Get invoice
      const invoice = await invoiceRepository.findById(input.invoiceId, ctx.user.id);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      // 3. Validate invoice for e-invoice
      const invoiceValidation = validateInvoiceForEInvoice(invoice);

      if (!invoiceValidation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invoice validation failed: ${invoiceValidation.errors.join(", ")}`,
        });
      }

      // 4. Check if already submitted successfully
      const latestSubmission = await einvoiceRepository.getLatestSubmissionForInvoice(input.invoiceId);

      if (latestSubmission && ["submitted", "valid"].includes(latestSubmission.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This invoice has already been submitted to MyInvois",
        });
      }

      // 5. Transform to MyInvois format
      const einvoiceSettings: EInvoiceSettings = {
        tin: settings.tin!,
        brn: settings.brn!,
        identificationScheme: settings.identificationScheme!,
        msicCode: settings.msicCode!,
        msicDescription: settings.msicDescription!,
        sstRegistration: settings.sstRegistration,
        tourismTaxRegistration: settings.tourismTaxRegistration,
      };

      const myinvoisDocument = transformInvoiceToMyInvois(
        invoice,
        einvoiceSettings,
        input.customerDetails as CustomerEInvoiceDetails | undefined
      );

      // 6. Create submission record
      const submission = await einvoiceRepository.createSubmission({
        invoiceId: input.invoiceId,
        documentType: "invoice",
        rawRequest: myinvoisDocument,
      });

      // 7. Submit to gateway
      try {
        const client = getGatewayClient();
        const response = await client.submitInvoice([myinvoisDocument], {
          dryRun: input.dryRun,
        });

        logger.info(
          {
            userId: ctx.user.id,
            invoiceId: input.invoiceId,
            submissionUid: response.submissionUid,
          },
          "Invoice submitted to MyInvois"
        );

        // 8. Update submission record
        if (response.acceptedDocuments.length > 0) {
          const accepted = response.acceptedDocuments[0]!;

          // Update submission and invoice status atomically
          await einvoiceRepository.updateSubmissionAndInvoiceStatus(
            submission!.id,
            input.invoiceId,
            ctx.user.id,
            {
              submissionUid: response.submissionUid,
              documentUuid: accepted.uuid,
              status: "submitted",
              submittedAt: new Date(),
              rawResponse: response,
            },
            "submitted"
          );

          return {
            success: true,
            submissionUid: response.submissionUid,
            documentUuid: accepted.uuid,
          };
        } else if (response.rejectedDocuments.length > 0) {
          const rejected = response.rejectedDocuments[0]!;

          await einvoiceRepository.updateSubmission(submission!.id, {
            status: "invalid",
            errorCode: rejected.error.code,
            errorMessage: rejected.error.message,
            rawResponse: response,
          });

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Document rejected: ${rejected.error.message}`,
          });
        }

        return {
          success: true,
          submissionUid: response.submissionUid,
        };
      } catch (error) {
        if (error instanceof MyInvoisGatewayError) {
          logger.error(
            { err: error, userId: ctx.user.id, invoiceId: input.invoiceId },
            "Gateway error during invoice submission"
          );

          await einvoiceRepository.updateSubmission(submission!.id, {
            status: "invalid",
            errorMessage: error.message,
            rawResponse: error.responseBody,
          });

          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `MyInvois Gateway error: ${error.message}`,
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit invoice to MyInvois",
          cause: error,
        });
      }
    }),

  submitCreditNote: protectedProcedure
    .input(submitCreditNoteSchema)
    .mutation(async ({ ctx, input }) => {
      // Similar to submitInvoice but uses credit note endpoint
      const settings = await einvoiceRepository.getSettings(ctx.user.id);

      if (!settings || !settings.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "E-invoice is not enabled",
        });
      }

      const invoice = await invoiceRepository.findById(input.invoiceId, ctx.user.id);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        });
      }

      const einvoiceSettings: EInvoiceSettings = {
        tin: settings.tin!,
        brn: settings.brn!,
        identificationScheme: settings.identificationScheme!,
        msicCode: settings.msicCode!,
        msicDescription: settings.msicDescription!,
        sstRegistration: settings.sstRegistration,
        tourismTaxRegistration: settings.tourismTaxRegistration,
      };

      const myinvoisDocument = transformToCreditNote(
        invoice,
        einvoiceSettings,
        input.originalInvoiceRef,
        input.customerDetails as CustomerEInvoiceDetails | undefined
      );

      const submission = await einvoiceRepository.createSubmission({
        invoiceId: input.invoiceId,
        documentType: "credit_note",
        rawRequest: myinvoisDocument,
      });

      try {
        const client = getGatewayClient();
        const response = await client.submitCreditNote([myinvoisDocument], {
          dryRun: input.dryRun,
        });

        if (response.acceptedDocuments.length > 0) {
          const accepted = response.acceptedDocuments[0]!;

          // Update submission and invoice status atomically
          await einvoiceRepository.updateSubmissionAndInvoiceStatus(
            submission!.id,
            input.invoiceId,
            ctx.user.id,
            {
              submissionUid: response.submissionUid,
              documentUuid: accepted.uuid,
              status: "submitted",
              submittedAt: new Date(),
              rawResponse: response,
            },
            "submitted"
          );

          return {
            success: true,
            submissionUid: response.submissionUid,
            documentUuid: accepted.uuid,
          };
        }

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Credit note submission rejected",
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit credit note",
          cause: error,
        });
      }
    }),

  submitDebitNote: protectedProcedure
    .input(submitDebitNoteSchema)
    .mutation(async ({ ctx, input }) => {
      // Similar to submitInvoice but uses debit note endpoint
      const settings = await einvoiceRepository.getSettings(ctx.user.id);

      if (!settings || !settings.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "E-invoice is not enabled",
        });
      }

      const invoice = await invoiceRepository.findById(input.invoiceId, ctx.user.id);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        });
      }

      const einvoiceSettings: EInvoiceSettings = {
        tin: settings.tin!,
        brn: settings.brn!,
        identificationScheme: settings.identificationScheme!,
        msicCode: settings.msicCode!,
        msicDescription: settings.msicDescription!,
        sstRegistration: settings.sstRegistration,
        tourismTaxRegistration: settings.tourismTaxRegistration,
      };

      const myinvoisDocument = transformToDebitNote(
        invoice,
        einvoiceSettings,
        input.originalInvoiceRef,
        input.customerDetails as CustomerEInvoiceDetails | undefined
      );

      const submission = await einvoiceRepository.createSubmission({
        invoiceId: input.invoiceId,
        documentType: "debit_note",
        rawRequest: myinvoisDocument,
      });

      try {
        const client = getGatewayClient();
        const response = await client.submitDebitNote([myinvoisDocument], {
          dryRun: input.dryRun,
        });

        if (response.acceptedDocuments.length > 0) {
          const accepted = response.acceptedDocuments[0]!;

          // Update submission and invoice status atomically
          await einvoiceRepository.updateSubmissionAndInvoiceStatus(
            submission!.id,
            input.invoiceId,
            ctx.user.id,
            {
              submissionUid: response.submissionUid,
              documentUuid: accepted.uuid,
              status: "submitted",
              submittedAt: new Date(),
              rawResponse: response,
            },
            "submitted"
          );

          return {
            success: true,
            submissionUid: response.submissionUid,
            documentUuid: accepted.uuid,
          };
        }

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debit note submission rejected",
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit debit note",
          cause: error,
        });
      }
    }),

  // ============================================
  // STATUS & HISTORY
  // ============================================

  getSubmissionStatus: protectedProcedure
    .input(z.object({ submissionUid: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const client = getGatewayClient();
        const status = await client.getSubmissionStatus(input.submissionUid);

        // Update local records if status changed
        for (const doc of status.documentSummary) {
          const submission = await einvoiceRepository.getSubmissionByDocumentUuid(doc.uuid);

          if (submission) {
            const newStatus = mapMyInvoisStatus(doc.status);

            if (newStatus && submission.status !== newStatus) {
              await einvoiceRepository.updateSubmission(submission.id, {
                status: newStatus,
                longId: doc.longId,
                validatedAt: doc.dateTimeValidated ? new Date(doc.dateTimeValidated) : undefined,
              });

              // Update invoice status
              if (submission.invoiceId) {
                await einvoiceRepository.updateInvoiceEInvoiceStatus(
                  submission.invoiceId,
                  ctx.user.id,
                  newStatus
                );
              }
            } else if (!newStatus) {
              logger.warn({ docUuid: doc.uuid, status: doc.status }, "Unknown status from MyInvois API");
            }
          }
        }

        return status;
      } catch (error) {
        logger.error({ err: error, submissionUid: input.submissionUid }, "Failed to get submission status");
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Failed to get submission status from MyInvois",
        });
      }
    }),

  getDocumentDetails: protectedProcedure
    .input(z.object({ documentUuid: z.string() }))
    .query(async ({ input }) => {
      try {
        const client = getGatewayClient();
        return await client.getDocument(input.documentUuid);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Failed to get document details from MyInvois",
        });
      }
    }),

  getSubmissionHistory: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify user owns the invoice
      const invoice = await invoiceRepository.findById(input.invoiceId, ctx.user.id);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      return einvoiceRepository.getSubmissionsByInvoiceId(input.invoiceId);
    }),

  // ============================================
  // DOCUMENT MANAGEMENT
  // ============================================

  cancelDocument: protectedProcedure
    .input(cancelDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      // Get latest submission
      const submission = await einvoiceRepository.getLatestSubmissionForInvoice(input.invoiceId);

      if (!submission || !submission.documentUuid) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No valid submission found for this invoice",
        });
      }

      if (submission.status !== "valid") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only valid documents can be cancelled",
        });
      }

      try {
        const client = getGatewayClient();
        await client.cancelDocument(submission.documentUuid, input.reason);

        await einvoiceRepository.updateSubmission(submission.id, {
          status: "cancelled",
          cancelledAt: new Date(),
        });

        await einvoiceRepository.updateInvoiceEInvoiceStatus(
          input.invoiceId,
          ctx.user.id,
          "cancelled"
        );

        logger.info(
          { userId: ctx.user.id, invoiceId: input.invoiceId, documentUuid: submission.documentUuid },
          "E-invoice document cancelled"
        );

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Failed to cancel document in MyInvois",
        });
      }
    }),

  // ============================================
  // BULK OPERATIONS
  // ============================================

  bulkSubmit: protectedProcedure
    .input(bulkSubmitSchema)
    .mutation(async ({ ctx, input }) => {
      const settings = await einvoiceRepository.getSettings(ctx.user.id);

      if (!settings || !settings.enabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "E-invoice is not enabled",
        });
      }

      const results: Array<{
        invoiceId: string;
        success: boolean;
        submissionUid?: string;
        documentUuid?: string;
        error?: string;
      }> = [];

      // Process each invoice
      for (const invoiceId of input.invoiceIds) {
        try {
          const invoice = await invoiceRepository.findById(invoiceId, ctx.user.id);

          if (!invoice) {
            results.push({
              invoiceId,
              success: false,
              error: "Invoice not found",
            });
            continue;
          }

          // Check if already submitted
          const latestSubmission = await einvoiceRepository.getLatestSubmissionForInvoice(invoiceId);

          if (latestSubmission && ["submitted", "valid"].includes(latestSubmission.status)) {
            results.push({
              invoiceId,
              success: false,
              error: "Already submitted",
            });
            continue;
          }

          const einvoiceSettings: EInvoiceSettings = {
            tin: settings.tin!,
            brn: settings.brn!,
            identificationScheme: settings.identificationScheme!,
            msicCode: settings.msicCode!,
            msicDescription: settings.msicDescription!,
            sstRegistration: settings.sstRegistration,
            tourismTaxRegistration: settings.tourismTaxRegistration,
          };

          const myinvoisDocument = transformInvoiceToMyInvois(invoice, einvoiceSettings);

          const submission = await einvoiceRepository.createSubmission({
            invoiceId,
            documentType: "invoice",
            rawRequest: myinvoisDocument,
          });

          const client = getGatewayClient();
          const response = await client.submitInvoice([myinvoisDocument], {
            dryRun: input.dryRun,
          });

          if (response.acceptedDocuments.length > 0) {
            const accepted = response.acceptedDocuments[0]!;

            // Update submission and invoice status atomically
            await einvoiceRepository.updateSubmissionAndInvoiceStatus(
              submission!.id,
              invoiceId,
              ctx.user.id,
              {
                submissionUid: response.submissionUid,
                documentUuid: accepted.uuid,
                status: "submitted",
                submittedAt: new Date(),
                rawResponse: response,
              },
              "submitted"
            );

            results.push({
              invoiceId,
              success: true,
              submissionUid: response.submissionUid,
              documentUuid: accepted.uuid,
            });
          } else {
            results.push({
              invoiceId,
              success: false,
              error: "Submission rejected",
            });
          }
        } catch (error) {
          results.push({
            invoiceId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      logger.info(
        { userId: ctx.user.id, total: input.invoiceIds.length, success: successCount },
        "Bulk e-invoice submission completed"
      );

      return {
        results,
        summary: {
          total: input.invoiceIds.length,
          success: successCount,
          failed: input.invoiceIds.length - successCount,
        },
      };
    }),

  // ============================================
  // VALIDATION
  // ============================================

  validateInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await invoiceRepository.findById(input.invoiceId, ctx.user.id);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      return validateInvoiceForEInvoice(invoice);
    }),
});
