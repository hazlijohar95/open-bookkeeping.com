/**
 * E-Invoice REST Routes
 * Provides REST API endpoints for MyInvois e-invoice integration
 */

import { Hono } from "hono";
import { z } from "zod";
import { einvoiceRepository, invoiceRepository } from "@open-bookkeeping/db";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";

export const einvoiceRoutes = new Hono();

// Validation schemas
const einvoiceSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  autoSubmit: z.boolean().optional(),
  tin: z.string().max(20).optional(),
  brn: z.string().max(50).optional(),
  identificationScheme: z.enum(["NRIC", "BRN", "PASSPORT", "ARMY"]).optional(),
  msicCode: z.string().max(10).optional(),
  msicDescription: z.string().max(500).optional(),
  sstRegistration: z.string().max(50).optional().nullable(),
  tourismTaxRegistration: z.string().max(50).optional().nullable(),
});

const submitInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
});

const bulkSubmitSchema = z.object({
  invoiceIds: z.array(z.string().uuid()),
});

const cancelSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// ============================================
// SETTINGS ENDPOINTS
// ============================================

// GET /einvoice/settings - Get e-invoice settings
einvoiceRoutes.get("/settings", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    let settings = await einvoiceRepository.getSettings(user.id);

    // Create default settings if none exist
    if (!settings) {
      settings = await einvoiceRepository.createSettings({
        userId: user.id,
        enabled: false,
        autoSubmit: false,
      });
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error fetching e-invoice settings:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch e-invoice settings");
  }
});

// PUT /einvoice/settings - Update e-invoice settings
einvoiceRoutes.put("/settings", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = einvoiceSettingsSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const settings = await einvoiceRepository.upsertSettings(user.id, validation.data);

    return c.json(settings);
  } catch (error) {
    console.error("Error updating e-invoice settings:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update e-invoice settings");
  }
});

// GET /einvoice/settings/validate - Validate e-invoice settings
einvoiceRoutes.get("/settings/validate", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const settings = await einvoiceRepository.getSettings(user.id);

    if (!settings) {
      return c.json({
        isValid: false,
        errors: ["E-invoice settings not configured"],
      });
    }

    const errors: string[] = [];

    // Validate required fields
    if (!settings.tin) {
      errors.push("TIN (Tax Identification Number) is required");
    }
    if (!settings.brn) {
      errors.push("BRN (Business Registration Number) is required");
    }
    if (!settings.msicCode) {
      errors.push("MSIC Code is required");
    }

    return c.json({
      isValid: errors.length === 0,
      errors,
      settings: {
        enabled: settings.enabled,
        autoSubmit: settings.autoSubmit,
        hasTin: !!settings.tin,
        hasBrn: !!settings.brn,
        hasMsic: !!settings.msicCode,
      },
    });
  } catch (error) {
    console.error("Error validating e-invoice settings:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to validate e-invoice settings");
  }
});

// ============================================
// SUBMISSION ENDPOINTS
// ============================================

// POST /einvoice/submit - Submit invoice to MyInvois
einvoiceRoutes.post("/submit", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = submitInvoiceSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { invoiceId } = validation.data;

    // Check if invoice exists and belongs to user
    const invoice = await invoiceRepository.findById(invoiceId, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    // Check if settings are configured
    const settings = await einvoiceRepository.getSettings(user.id);
    if (!settings?.enabled) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "E-invoice is not enabled");
    }

    // Create submission record
    const submission = await einvoiceRepository.createSubmission({
      invoiceId,
      documentType: "invoice",
      rawRequest: { invoiceId, timestamp: new Date().toISOString() },
    });

    // Note: Actual submission to MyInvois would be done by a background worker
    // For now, we just create the submission record

    return c.json({
      success: true,
      submissionId: submission?.id,
      status: "pending",
      message: "Invoice queued for e-invoice submission",
    });
  } catch (error) {
    console.error("Error submitting e-invoice:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to submit e-invoice");
  }
});

// POST /einvoice/submit-credit-note - Submit credit note
einvoiceRoutes.post("/submit-credit-note", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = submitInvoiceSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { invoiceId } = validation.data;

    // Create submission record for credit note
    const submission = await einvoiceRepository.createSubmission({
      invoiceId,
      documentType: "credit_note",
      rawRequest: { invoiceId, timestamp: new Date().toISOString() },
    });

    return c.json({
      success: true,
      submissionId: submission?.id,
      status: "pending",
      message: "Credit note queued for e-invoice submission",
    });
  } catch (error) {
    console.error("Error submitting credit note:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to submit credit note");
  }
});

// POST /einvoice/submit-debit-note - Submit debit note
einvoiceRoutes.post("/submit-debit-note", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = submitInvoiceSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { invoiceId } = validation.data;

    // Create submission record for debit note
    const submission = await einvoiceRepository.createSubmission({
      invoiceId,
      documentType: "debit_note",
      rawRequest: { invoiceId, timestamp: new Date().toISOString() },
    });

    return c.json({
      success: true,
      submissionId: submission?.id,
      status: "pending",
      message: "Debit note queued for e-invoice submission",
    });
  } catch (error) {
    console.error("Error submitting debit note:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to submit debit note");
  }
});

// POST /einvoice/bulk-submit - Bulk submit invoices
einvoiceRoutes.post("/bulk-submit", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = bulkSubmitSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { invoiceIds } = validation.data;

    // Create submission records for all invoices
    const submissions = await Promise.all(
      invoiceIds.map(async (invoiceId) => {
        try {
          const submission = await einvoiceRepository.createSubmission({
            invoiceId,
            documentType: "invoice",
            rawRequest: { invoiceId, timestamp: new Date().toISOString() },
          });
          return { invoiceId, submissionId: submission?.id, status: "queued" };
        } catch {
          return { invoiceId, status: "failed", error: "Failed to queue" };
        }
      })
    );

    return c.json({
      success: true,
      total: invoiceIds.length,
      queued: submissions.filter((s) => s.status === "queued").length,
      failed: submissions.filter((s) => s.status === "failed").length,
      submissions,
    });
  } catch (error) {
    console.error("Error bulk submitting e-invoices:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to bulk submit e-invoices");
  }
});

// POST /einvoice/cancel - Cancel e-invoice
einvoiceRoutes.post("/cancel", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = cancelSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const { invoiceId, reason } = validation.data;

    // Get the latest submission for this invoice
    const submission = await einvoiceRepository.getLatestSubmissionForInvoice(invoiceId);

    if (!submission) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "No e-invoice submission found for this invoice");
    }

    if (submission.status !== "valid") {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, "Only validated e-invoices can be cancelled");
    }

    // Update submission status
    await einvoiceRepository.updateSubmission(submission.id, {
      status: "cancelled",
      cancelledAt: new Date(),
      errorMessage: reason ?? "Cancelled by user",
    });

    return c.json({
      success: true,
      message: "E-invoice cancellation requested",
    });
  } catch (error) {
    console.error("Error cancelling e-invoice:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to cancel e-invoice");
  }
});

// ============================================
// QUERY ENDPOINTS
// ============================================

// GET /einvoice/history/:invoiceId - Get submission history for invoice
einvoiceRoutes.get("/history/:invoiceId", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const invoiceId = c.req.param("invoiceId");

    // Verify invoice belongs to user
    const invoice = await invoiceRepository.findById(invoiceId, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    const submissions = await einvoiceRepository.getSubmissionsByInvoiceId(invoiceId);

    return c.json(submissions);
  } catch (error) {
    console.error("Error fetching e-invoice history:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch e-invoice history");
  }
});

// GET /einvoice/validate/:invoiceId - Validate invoice for e-invoice submission
einvoiceRoutes.get("/validate/:invoiceId", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const invoiceId = c.req.param("invoiceId");

    const invoice = await invoiceRepository.findById(invoiceId, user.id);
    if (!invoice) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Invoice not found");
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields for e-invoice
    const clientDetails = invoice.invoiceFields?.clientDetails;
    const items = invoice.invoiceFields?.items;

    if (!clientDetails?.name) {
      errors.push("Customer name is required");
    }
    // In the old invoice schema, taxId is stored in metadata array
    const clientTaxId = clientDetails?.metadata?.find(
      (m) => m.label.toLowerCase() === "tin" || m.label.toLowerCase() === "tax id"
    )?.value;
    if (!clientTaxId) {
      warnings.push("Customer TIN is recommended for e-invoice");
    }
    if (!items || items.length === 0) {
      errors.push("Invoice must have at least one line item");
    }

    return c.json({
      isValid: errors.length === 0,
      errors,
      warnings,
      invoiceId,
    });
  } catch (error) {
    console.error("Error validating invoice:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to validate invoice");
  }
});

// GET /einvoice/submission-status/:submissionUid - Get submission status
einvoiceRoutes.get("/submission-status/:submissionUid", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  try {
    const submissionUid = c.req.param("submissionUid");

    const submission = await einvoiceRepository.getSubmissionById(submissionUid);

    if (!submission) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Submission not found");
    }

    return c.json(submission);
  } catch (error) {
    console.error("Error fetching submission status:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch submission status");
  }
});

// GET /einvoice/document/:documentUuid - Get validated document
einvoiceRoutes.get("/document/:documentUuid", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;

  try {
    const documentUuid = c.req.param("documentUuid");

    const submission = await einvoiceRepository.getSubmissionByDocumentUuid(documentUuid);

    if (!submission) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Document not found");
    }

    // Return the submission with document details
    return c.json({
      documentUuid: submission.documentUuid,
      longId: submission.longId,
      status: submission.status,
      submittedAt: submission.submittedAt,
      validatedAt: submission.validatedAt,
    });
  } catch (error) {
    console.error("Error fetching document:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch document");
  }
});
