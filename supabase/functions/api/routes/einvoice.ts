/**
 * E-Invoice Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/einvoice.ts
 * Handles Malaysian MyInvois integration
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

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
  invoiceId: z.string().uuid(),
  originalInvoiceRef: z.object({
    id: z.string(),
    uuid: z.string().optional(),
    issueDate: z.string().optional(),
  }),
  customerDetails: customerEInvoiceDetailsSchema,
  dryRun: z.boolean().optional(),
});

const submitDebitNoteSchema = z.object({
  invoiceId: z.string().uuid(),
  originalInvoiceRef: z.object({
    id: z.string(),
    uuid: z.string().optional(),
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
// HELPER FUNCTIONS
// ============================================

function validateEInvoiceSettings(settings: {
  tin?: string;
  brn?: string;
  identificationScheme?: string;
  msicCode?: string;
  msicDescription?: string;
}) {
  const errors: string[] = [];

  if (!settings.tin) errors.push("TIN is required");
  if (!settings.brn) errors.push("BRN is required");
  if (!settings.identificationScheme) errors.push("Identification scheme is required");
  if (!settings.msicCode) errors.push("MSIC code is required");
  if (!settings.msicDescription) errors.push("MSIC description is required");

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// SETTINGS ROUTES
// ============================================

// Get e-invoice settings
app.get("/settings", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: settings, error } = await db
    .from("einvoice_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching e-invoice settings:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }

  return c.json(settings || {
    enabled: false,
    autoSubmit: false,
    tin: null,
    brn: null,
    identificationScheme: null,
    msicCode: null,
    msicDescription: null,
    sstRegistration: null,
    tourismTaxRegistration: null,
  });
});

// Update e-invoice settings
app.put("/settings", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = einvoiceSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // Check if settings exist
  const { data: existing } = await db
    .from("einvoice_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const settingsData = {
    user_id: user.id,
    enabled: input.enabled,
    auto_submit: input.autoSubmit,
    tin: input.tin,
    brn: input.brn,
    identification_scheme: input.identificationScheme,
    msic_code: input.msicCode,
    msic_description: input.msicDescription,
    sst_registration: input.sstRegistration,
    tourism_tax_registration: input.tourismTaxRegistration,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    const { data, error } = await db
      .from("einvoice_settings")
      .update(settingsData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating e-invoice settings:", error);
      return c.json({ error: "Failed to update settings" }, 500);
    }
    result = data;
  } else {
    const { data, error } = await db
      .from("einvoice_settings")
      .insert(settingsData)
      .select()
      .single();

    if (error) {
      console.error("Error creating e-invoice settings:", error);
      return c.json({ error: "Failed to create settings" }, 500);
    }
    result = data;
  }

  return c.json(result);
});

// Validate settings
app.get("/settings/validate", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const { data: settings } = await db
    .from("einvoice_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!settings) {
    return c.json({
      valid: false,
      errors: ["E-invoice settings not configured"],
    });
  }

  return c.json(validateEInvoiceSettings({
    tin: settings.tin || undefined,
    brn: settings.brn || undefined,
    identificationScheme: settings.identification_scheme || undefined,
    msicCode: settings.msic_code || undefined,
    msicDescription: settings.msic_description || undefined,
  }));
});

// ============================================
// SUBMISSION ROUTES
// ============================================

// Submit invoice to MyInvois
app.post("/submit", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = submitInvoiceSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // 1. Get settings
  const { data: settings } = await db
    .from("einvoice_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!settings || !settings.enabled) {
    return c.json({
      error: "E-invoice is not enabled. Please configure your settings first.",
    }, 412);
  }

  // Validate settings
  const settingsValidation = validateEInvoiceSettings({
    tin: settings.tin || undefined,
    brn: settings.brn || undefined,
    identificationScheme: settings.identification_scheme || undefined,
    msicCode: settings.msic_code || undefined,
    msicDescription: settings.msic_description || undefined,
  });

  if (!settingsValidation.valid) {
    return c.json({
      error: `Invalid e-invoice settings: ${settingsValidation.errors.join(", ")}`,
    }, 412);
  }

  // 2. Get invoice
  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .select(`
      *,
      invoice_fields(*),
      customer:customers(*)
    `)
    .eq("id", input.invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (invoiceError || !invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // 3. Check if already submitted
  const { data: latestSubmission } = await db
    .from("einvoice_submissions")
    .select("*")
    .eq("invoice_id", input.invoiceId)
    .in("status", ["submitted", "valid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestSubmission) {
    return c.json({
      error: "This invoice has already been submitted to MyInvois",
    }, 409);
  }

  // 4. Create submission record
  const { data: submission, error: submissionError } = await db
    .from("einvoice_submissions")
    .insert({
      invoice_id: input.invoiceId,
      document_type: "invoice",
      status: "pending",
      raw_request: { invoiceId: input.invoiceId, customerDetails: input.customerDetails },
    })
    .select()
    .single();

  if (submissionError) {
    console.error("Error creating submission:", submissionError);
    return c.json({ error: "Failed to create submission record" }, 500);
  }

  // 5. TODO: Submit to MyInvois Gateway
  // In production, this would call the actual MyInvois API
  // For now, we'll simulate a successful submission

  if (input.dryRun) {
    return c.json({
      success: true,
      dryRun: true,
      submissionId: submission.id,
      message: "Dry run - document not actually submitted",
    });
  }

  // Simulate successful submission
  const mockSubmissionUid = `SUB-${Date.now()}`;
  const mockDocumentUuid = `DOC-${Date.now()}`;

  // Update submission record
  await db
    .from("einvoice_submissions")
    .update({
      submission_uid: mockSubmissionUid,
      document_uuid: mockDocumentUuid,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submission.id);

  // Update invoice e-invoice status
  await db
    .from("invoices")
    .update({
      einvoice_status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.invoiceId)
    .eq("user_id", user.id);

  return c.json({
    success: true,
    submissionUid: mockSubmissionUid,
    documentUuid: mockDocumentUuid,
  });
});

// Submit credit note
app.post("/submit-credit-note", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = submitCreditNoteSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // Similar flow to submitInvoice but for credit notes
  const { data: settings } = await db
    .from("einvoice_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!settings || !settings.enabled) {
    return c.json({
      error: "E-invoice is not enabled",
    }, 412);
  }

  // Create submission record
  const { data: submission, error } = await db
    .from("einvoice_submissions")
    .insert({
      invoice_id: input.invoiceId,
      document_type: "credit_note",
      status: "pending",
      raw_request: input,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: "Failed to create submission" }, 500);
  }

  if (input.dryRun) {
    return c.json({
      success: true,
      dryRun: true,
      submissionId: submission.id,
    });
  }

  // Simulate successful submission
  const mockSubmissionUid = `SUB-CN-${Date.now()}`;
  const mockDocumentUuid = `DOC-CN-${Date.now()}`;

  await db
    .from("einvoice_submissions")
    .update({
      submission_uid: mockSubmissionUid,
      document_uuid: mockDocumentUuid,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submission.id);

  return c.json({
    success: true,
    submissionUid: mockSubmissionUid,
    documentUuid: mockDocumentUuid,
  });
});

// Submit debit note
app.post("/submit-debit-note", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = submitDebitNoteSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  const { data: settings } = await db
    .from("einvoice_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!settings || !settings.enabled) {
    return c.json({
      error: "E-invoice is not enabled",
    }, 412);
  }

  const { data: submission, error } = await db
    .from("einvoice_submissions")
    .insert({
      invoice_id: input.invoiceId,
      document_type: "debit_note",
      status: "pending",
      raw_request: input,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: "Failed to create submission" }, 500);
  }

  if (input.dryRun) {
    return c.json({
      success: true,
      dryRun: true,
      submissionId: submission.id,
    });
  }

  const mockSubmissionUid = `SUB-DN-${Date.now()}`;
  const mockDocumentUuid = `DOC-DN-${Date.now()}`;

  await db
    .from("einvoice_submissions")
    .update({
      submission_uid: mockSubmissionUid,
      document_uuid: mockDocumentUuid,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submission.id);

  return c.json({
    success: true,
    submissionUid: mockSubmissionUid,
    documentUuid: mockDocumentUuid,
  });
});

// ============================================
// STATUS & HISTORY ROUTES
// ============================================

// Get submission status
app.get("/submission-status/:submissionUid", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const submissionUid = c.req.param("submissionUid");

  const { data: submission, error } = await db
    .from("einvoice_submissions")
    .select(`
      *,
      invoice:invoices!inner(user_id)
    `)
    .eq("submission_uid", submissionUid)
    .single();

  if (error || !submission) {
    return c.json({ error: "Submission not found" }, 404);
  }

  // Verify user owns the invoice
  if (submission.invoice?.user_id !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json({
    id: submission.id,
    submissionUid: submission.submission_uid,
    documentUuid: submission.document_uuid,
    status: submission.status,
    submittedAt: submission.submitted_at,
    validatedAt: submission.validated_at,
    longId: submission.long_id,
  });
});

// Get document details
app.get("/document/:documentUuid", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const documentUuid = c.req.param("documentUuid");

  const { data: submission, error } = await db
    .from("einvoice_submissions")
    .select(`
      *,
      invoice:invoices!inner(user_id)
    `)
    .eq("document_uuid", documentUuid)
    .single();

  if (error || !submission) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (submission.invoice?.user_id !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  return c.json(submission);
});

// Get submission history for an invoice
app.get("/history/:invoiceId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const invoiceId = c.req.param("invoiceId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(invoiceId).success) {
    return c.json({ error: "Invalid invoice ID format" }, 400);
  }

  // Verify user owns the invoice
  const { data: invoice } = await db
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  const { data: submissions, error } = await db
    .from("einvoice_submissions")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching submission history:", error);
    return c.json({ error: "Failed to fetch history" }, 500);
  }

  return c.json(submissions);
});

// ============================================
// DOCUMENT MANAGEMENT
// ============================================

// Cancel document
app.post("/cancel", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = cancelDocumentSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // Get latest submission
  const { data: submission } = await db
    .from("einvoice_submissions")
    .select(`
      *,
      invoice:invoices!inner(user_id)
    `)
    .eq("invoice_id", input.invoiceId)
    .eq("status", "valid")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!submission || !submission.document_uuid) {
    return c.json({
      error: "No valid submission found for this invoice",
    }, 404);
  }

  if (submission.invoice?.user_id !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  // Update submission status
  await db
    .from("einvoice_submissions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", submission.id);

  // Update invoice status
  await db
    .from("invoices")
    .update({
      einvoice_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.invoiceId)
    .eq("user_id", user.id);

  return c.json({ success: true });
});

// ============================================
// BULK OPERATIONS
// ============================================

// Bulk submit invoices
app.post("/bulk-submit", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = bulkSubmitSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const input = parseResult.data;

  // Check settings
  const { data: settings } = await db
    .from("einvoice_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!settings || !settings.enabled) {
    return c.json({
      error: "E-invoice is not enabled",
    }, 412);
  }

  const results: Array<{
    invoiceId: string;
    success: boolean;
    submissionUid?: string;
    documentUuid?: string;
    error?: string;
  }> = [];

  for (const invoiceId of input.invoiceIds) {
    try {
      // Get invoice
      const { data: invoice } = await db
        .from("invoices")
        .select("id")
        .eq("id", invoiceId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

      if (!invoice) {
        results.push({
          invoiceId,
          success: false,
          error: "Invoice not found",
        });
        continue;
      }

      // Check if already submitted
      const { data: existing } = await db
        .from("einvoice_submissions")
        .select("id")
        .eq("invoice_id", invoiceId)
        .in("status", ["submitted", "valid"])
        .limit(1)
        .single();

      if (existing) {
        results.push({
          invoiceId,
          success: false,
          error: "Already submitted",
        });
        continue;
      }

      // Create submission
      const { data: submission } = await db
        .from("einvoice_submissions")
        .insert({
          invoice_id: invoiceId,
          document_type: "invoice",
          status: "pending",
        })
        .select()
        .single();

      if (input.dryRun) {
        results.push({
          invoiceId,
          success: true,
        });
        continue;
      }

      // Simulate submission
      const mockSubmissionUid = `SUB-${Date.now()}-${invoiceId.slice(0, 8)}`;
      const mockDocumentUuid = `DOC-${Date.now()}-${invoiceId.slice(0, 8)}`;

      await db
        .from("einvoice_submissions")
        .update({
          submission_uid: mockSubmissionUid,
          document_uuid: mockDocumentUuid,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", submission!.id);

      await db
        .from("invoices")
        .update({
          einvoice_status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      results.push({
        invoiceId,
        success: true,
        submissionUid: mockSubmissionUid,
        documentUuid: mockDocumentUuid,
      });
    } catch (error) {
      results.push({
        invoiceId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return c.json({
    results,
    summary: {
      total: input.invoiceIds.length,
      success: successCount,
      failed: input.invoiceIds.length - successCount,
    },
  });
});

// ============================================
// VALIDATION
// ============================================

// Validate invoice for e-invoice
app.get("/validate/:invoiceId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const invoiceId = c.req.param("invoiceId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(invoiceId).success) {
    return c.json({ error: "Invalid invoice ID format" }, 400);
  }

  const { data: invoice, error } = await db
    .from("invoices")
    .select(`
      *,
      invoice_fields(*),
      customer:customers(*)
    `)
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !invoice) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  // Validate invoice fields for e-invoice
  const errors: string[] = [];

  if (!invoice.customer) {
    errors.push("Customer is required");
  }

  const invoiceFields = invoice.invoice_fields;
  if (!invoiceFields) {
    errors.push("Invoice details are required");
  } else {
    if (!invoiceFields.items || invoiceFields.items.length === 0) {
      errors.push("At least one line item is required");
    }
  }

  return c.json({
    valid: errors.length === 0,
    errors,
  });
});

export default app;
