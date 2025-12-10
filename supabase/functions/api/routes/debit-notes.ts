/**
 * Debit Note Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/debitNote.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Zod schemas
const metadataItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const billingDetailSchema = z.object({
  label: z.string(),
  type: z.enum(["fixed", "percentage"]),
  value: z.number(),
});

const debitNoteItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const createDebitNoteSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  reason: z.enum(["return", "discount", "pricing_error", "damaged_goods", "other"]),
  reasonDescription: z.string().optional(),
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
  debitNoteDetails: z.object({
    theme: z.object({
      baseColor: z.string(),
      mode: z.enum(["dark", "light"]),
      template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
    }).optional(),
    currency: z.string(),
    prefix: z.string().default("DN-"),
    serialNumber: z.string(),
    date: z.string(),
    originalInvoiceNumber: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(debitNoteItemSchema),
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
  }).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// List all debit notes with pagination
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: debitNotes, error, count } = await db
    .from("debit_notes")
    .select(`
      *,
      invoice:invoices(id, status),
      customer:customers(id, name, email),
      vendor:vendors(id, name),
      debit_note_fields(
        id,
        company_details:debit_note_company_details(*),
        client_details:debit_note_client_details(*),
        debit_note_details:debit_note_details(*),
        items:debit_note_items(*),
        metadata:debit_note_metadata(*)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching debit notes:", error);
    return c.json({ error: "Failed to fetch debit notes" }, 500);
  }

  return c.json({
    data: debitNotes,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get a single debit note by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid debit note ID format" }, 400);
  }

  const { data: debitNote, error } = await db
    .from("debit_notes")
    .select(`
      *,
      invoice:invoices(*),
      customer:customers(*),
      vendor:vendors(*),
      debit_note_fields(
        id,
        company_details:debit_note_company_details(
          *,
          metadata:debit_note_company_details_metadata(*)
        ),
        client_details:debit_note_client_details(
          *,
          metadata:debit_note_client_details_metadata(*)
        ),
        debit_note_details:debit_note_details(
          *,
          billing_details:debit_note_details_billing_details(*)
        ),
        items:debit_note_items(*),
        metadata:debit_note_metadata(*)
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Debit note not found" }, 404);
    }
    console.error("Error fetching debit note:", error);
    return c.json({ error: "Failed to fetch debit note" }, 500);
  }

  return c.json(debitNote);
});

// Create a new debit note
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createDebitNoteSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  try {
    // Create debit note
    const { data: debitNote, error: dnError } = await db
      .from("debit_notes")
      .insert({
        user_id: user.id,
        invoice_id: input.invoiceId || null,
        customer_id: input.customerId || null,
        vendor_id: input.vendorId || null,
        type: "server",
        status: "draft",
        reason: input.reason,
        reason_description: input.reasonDescription || null,
      })
      .select()
      .single();

    if (dnError) throw dnError;

    // Create debit note fields
    const { data: field, error: fieldError } = await db
      .from("debit_note_fields")
      .insert({ debit_note_id: debitNote.id })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // Create company details
    const { data: companyDetail, error: companyError } = await db
      .from("debit_note_company_details")
      .insert({
        debit_note_field_id: field.id,
        name: input.companyDetails.name,
        address: input.companyDetails.address,
        logo: input.companyDetails.logo || null,
        signature: input.companyDetails.signature || null,
      })
      .select()
      .single();

    if (companyError) throw companyError;

    // Create company metadata
    if (input.companyDetails.metadata?.length) {
      const { error: metaError } = await db
        .from("debit_note_company_details_metadata")
        .insert(
          input.companyDetails.metadata.map((m) => ({
            debit_note_company_details_id: companyDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create client details
    const { data: clientDetail, error: clientError } = await db
      .from("debit_note_client_details")
      .insert({
        debit_note_field_id: field.id,
        name: input.clientDetails.name,
        address: input.clientDetails.address,
      })
      .select()
      .single();

    if (clientError) throw clientError;

    // Create client metadata
    if (input.clientDetails.metadata?.length) {
      const { error: metaError } = await db
        .from("debit_note_client_details_metadata")
        .insert(
          input.clientDetails.metadata.map((m) => ({
            debit_note_client_details_id: clientDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create debit note details
    const { data: detail, error: detailError } = await db
      .from("debit_note_details")
      .insert({
        debit_note_field_id: field.id,
        theme: input.debitNoteDetails.theme || null,
        currency: input.debitNoteDetails.currency,
        prefix: input.debitNoteDetails.prefix,
        serial_number: input.debitNoteDetails.serialNumber,
        date: input.debitNoteDetails.date,
        original_invoice_number: input.debitNoteDetails.originalInvoiceNumber || null,
      })
      .select()
      .single();

    if (detailError) throw detailError;

    // Create billing details
    if (input.debitNoteDetails.billingDetails?.length) {
      const { error: billingError } = await db
        .from("debit_note_details_billing_details")
        .insert(
          input.debitNoteDetails.billingDetails.map((b) => ({
            debit_note_details_id: detail.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
          }))
        );
      if (billingError) throw billingError;
    }

    // Create items
    if (input.items.length) {
      const { error: itemsError } = await db
        .from("debit_note_items")
        .insert(
          input.items.map((item) => ({
            debit_note_field_id: field.id,
            name: item.name,
            description: item.description || null,
            quantity: item.quantity,
            unit_price: String(item.unitPrice),
          }))
        );
      if (itemsError) throw itemsError;
    }

    // Create metadata
    if (input.metadata) {
      const { error: metaError } = await db
        .from("debit_note_metadata")
        .insert({
          debit_note_field_id: field.id,
          notes: input.metadata.notes || null,
          terms: input.metadata.terms || null,
        });
      if (metaError) throw metaError;
    }

    return c.json({ debitNoteId: debitNote.id }, 201);
  } catch (error) {
    console.error("Error creating debit note:", error);
    return c.json({ error: "Failed to create debit note" }, 500);
  }
});

// Create debit note from invoice
app.post("/from-invoice/:invoiceId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const invoiceId = c.req.param("invoiceId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(invoiceId).success) {
    return c.json({ error: "Invalid invoice ID format" }, 400);
  }

  const body = await c.req.json();
  const reasonSchema = z.object({
    reason: z.enum(["return", "discount", "pricing_error", "damaged_goods", "other"]),
    reasonDescription: z.string().optional(),
  });

  const parseResult = reasonSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  // Fetch the invoice with all related data
  const { data: invoice, error: fetchError } = await db
    .from("invoices")
    .select(`
      *,
      invoice_fields(
        company_details:invoice_company_details(
          *,
          metadata:invoice_company_details_metadata(*)
        ),
        client_details:invoice_client_details(
          *,
          metadata:invoice_client_details_metadata(*)
        ),
        invoice_details:invoice_details(
          *,
          billing_details:invoice_details_billing_details(*)
        ),
        items:invoice_items(*),
        metadata:invoice_metadata(*)
      )
    `)
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Invoice not found" }, 404);
    }
    console.error("Error fetching invoice:", fetchError);
    return c.json({ error: "Failed to fetch invoice" }, 500);
  }

  const invf = invoice.invoice_fields?.[0];
  if (!invf) {
    return c.json({ error: "Invoice data is incomplete" }, 500);
  }

  try {
    // Create debit note from invoice
    const { data: debitNote, error: dnError } = await db
      .from("debit_notes")
      .insert({
        user_id: user.id,
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        vendor_id: invoice.vendor_id,
        type: "server",
        status: "draft",
        reason: parseResult.data.reason,
        reason_description: parseResult.data.reasonDescription || null,
      })
      .select()
      .single();

    if (dnError) throw dnError;

    // Create debit note fields
    const { data: field, error: fieldError } = await db
      .from("debit_note_fields")
      .insert({ debit_note_id: debitNote.id })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // Copy company details
    if (invf.company_details?.[0]) {
      const cd = invf.company_details[0];
      const { data: companyDetail, error: companyError } = await db
        .from("debit_note_company_details")
        .insert({
          debit_note_field_id: field.id,
          name: cd.name,
          address: cd.address,
          logo: cd.logo,
          signature: cd.signature,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      if (cd.metadata?.length) {
        const { error: metaError } = await db
          .from("debit_note_company_details_metadata")
          .insert(
            cd.metadata.map((m: { label: string; value: string }) => ({
              debit_note_company_details_id: companyDetail.id,
              label: m.label,
              value: m.value,
            }))
          );
        if (metaError) throw metaError;
      }
    }

    // Copy client details
    if (invf.client_details?.[0]) {
      const cld = invf.client_details[0];
      const { data: clientDetail, error: clientError } = await db
        .from("debit_note_client_details")
        .insert({
          debit_note_field_id: field.id,
          name: cld.name,
          address: cld.address,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      if (cld.metadata?.length) {
        const { error: metaError } = await db
          .from("debit_note_client_details_metadata")
          .insert(
            cld.metadata.map((m: { label: string; value: string }) => ({
              debit_note_client_details_id: clientDetail.id,
              label: m.label,
              value: m.value,
            }))
          );
        if (metaError) throw metaError;
      }
    }

    // Copy invoice details to debit note details
    if (invf.invoice_details?.[0]) {
      const invd = invf.invoice_details[0];
      const originalInvoiceNumber = `${invd.prefix}${invd.serial_number}`;

      const { data: detail, error: detailError } = await db
        .from("debit_note_details")
        .insert({
          debit_note_field_id: field.id,
          theme: invd.theme,
          currency: invd.currency,
          prefix: "DN-",
          serial_number: `${Date.now()}`,
          date: new Date().toISOString(),
          original_invoice_number: originalInvoiceNumber,
        })
        .select()
        .single();

      if (detailError) throw detailError;

      if (invd.billing_details?.length) {
        const { error: billingError } = await db
          .from("debit_note_details_billing_details")
          .insert(
            invd.billing_details.map((b: { label: string; type: string; value: string }) => ({
              debit_note_details_id: detail.id,
              label: b.label,
              type: b.type,
              value: b.value,
            }))
          );
        if (billingError) throw billingError;
      }
    }

    // Copy items
    if (invf.items?.length) {
      const { error: itemsError } = await db
        .from("debit_note_items")
        .insert(
          invf.items.map((item: { name: string; description: string | null; quantity: number; unit_price: string }) => ({
            debit_note_field_id: field.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))
        );
      if (itemsError) throw itemsError;
    }

    // Copy metadata
    if (invf.metadata?.[0]) {
      const { error: metaError } = await db
        .from("debit_note_metadata")
        .insert({
          debit_note_field_id: field.id,
          notes: invf.metadata[0].notes,
          terms: invf.metadata[0].terms,
        });
      if (metaError) throw metaError;
    }

    return c.json({
      debitNoteId: debitNote.id,
      invoiceId: invoice.id,
    }, 201);
  } catch (error) {
    console.error("Error creating debit note from invoice:", error);
    return c.json({ error: "Failed to create debit note from invoice" }, 500);
  }
});

// Update debit note status
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid debit note ID format" }, 400);
  }

  const body = await c.req.json();
  const statusSchema = z.object({
    status: z.enum(["draft", "issued", "applied", "cancelled"]),
  });

  const parseResult = statusSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const updateData: Record<string, unknown> = {
    status: parseResult.data.status,
    updated_at: new Date().toISOString(),
  };

  if (parseResult.data.status === "issued") {
    updateData.issued_at = new Date().toISOString();
  }

  const { data: debitNote, error } = await db
    .from("debit_notes")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Debit note not found" }, 404);
    }
    console.error("Error updating debit note status:", error);
    return c.json({ error: "Failed to update debit note status" }, 500);
  }

  return c.json({ success: true, debitNote });
});

// Delete a debit note
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid debit note ID format" }, 400);
  }

  // Check if it's a draft
  const { data: debitNote, error: fetchError } = await db
    .from("debit_notes")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Debit note not found" }, 404);
    }
    console.error("Error fetching debit note:", fetchError);
    return c.json({ error: "Failed to fetch debit note" }, 500);
  }

  if (debitNote.status !== "draft") {
    return c.json({ error: "Only draft debit notes can be deleted" }, 400);
  }

  const { error: deleteError } = await db
    .from("debit_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Error deleting debit note:", deleteError);
    return c.json({ error: "Failed to delete debit note" }, 500);
  }

  return c.json({ success: true });
});

export default app;
