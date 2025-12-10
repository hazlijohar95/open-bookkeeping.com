/**
 * Credit Note Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/creditNote.ts
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

const creditNoteItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const createCreditNoteSchema = z.object({
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
  creditNoteDetails: z.object({
    theme: z.object({
      baseColor: z.string(),
      mode: z.enum(["dark", "light"]),
      template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
    }).optional(),
    currency: z.string(),
    prefix: z.string().default("CN-"),
    serialNumber: z.string(),
    date: z.string(),
    originalInvoiceNumber: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(creditNoteItemSchema),
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
  }).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// List all credit notes with pagination
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: creditNotes, error, count } = await db
    .from("credit_notes")
    .select(`
      *,
      invoice:invoices(id, status),
      customer:customers(id, name, email),
      vendor:vendors(id, name),
      credit_note_fields(
        id,
        company_details:credit_note_company_details(*),
        client_details:credit_note_client_details(*),
        credit_note_details:credit_note_details(*),
        items:credit_note_items(*),
        metadata:credit_note_metadata(*)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching credit notes:", error);
    return c.json({ error: "Failed to fetch credit notes" }, 500);
  }

  return c.json({
    data: creditNotes,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get a single credit note by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid credit note ID format" }, 400);
  }

  const { data: creditNote, error } = await db
    .from("credit_notes")
    .select(`
      *,
      invoice:invoices(*),
      customer:customers(*),
      vendor:vendors(*),
      credit_note_fields(
        id,
        company_details:credit_note_company_details(
          *,
          metadata:credit_note_company_details_metadata(*)
        ),
        client_details:credit_note_client_details(
          *,
          metadata:credit_note_client_details_metadata(*)
        ),
        credit_note_details:credit_note_details(
          *,
          billing_details:credit_note_details_billing_details(*)
        ),
        items:credit_note_items(*),
        metadata:credit_note_metadata(*)
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Credit note not found" }, 404);
    }
    console.error("Error fetching credit note:", error);
    return c.json({ error: "Failed to fetch credit note" }, 500);
  }

  return c.json(creditNote);
});

// Create a new credit note
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createCreditNoteSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  try {
    // Create credit note
    const { data: creditNote, error: cnError } = await db
      .from("credit_notes")
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

    if (cnError) throw cnError;

    // Create credit note fields
    const { data: field, error: fieldError } = await db
      .from("credit_note_fields")
      .insert({ credit_note_id: creditNote.id })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // Create company details
    const { data: companyDetail, error: companyError } = await db
      .from("credit_note_company_details")
      .insert({
        credit_note_field_id: field.id,
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
        .from("credit_note_company_details_metadata")
        .insert(
          input.companyDetails.metadata.map((m) => ({
            credit_note_company_details_id: companyDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create client details
    const { data: clientDetail, error: clientError } = await db
      .from("credit_note_client_details")
      .insert({
        credit_note_field_id: field.id,
        name: input.clientDetails.name,
        address: input.clientDetails.address,
      })
      .select()
      .single();

    if (clientError) throw clientError;

    // Create client metadata
    if (input.clientDetails.metadata?.length) {
      const { error: metaError } = await db
        .from("credit_note_client_details_metadata")
        .insert(
          input.clientDetails.metadata.map((m) => ({
            credit_note_client_details_id: clientDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create credit note details
    const { data: detail, error: detailError } = await db
      .from("credit_note_details")
      .insert({
        credit_note_field_id: field.id,
        theme: input.creditNoteDetails.theme || null,
        currency: input.creditNoteDetails.currency,
        prefix: input.creditNoteDetails.prefix,
        serial_number: input.creditNoteDetails.serialNumber,
        date: input.creditNoteDetails.date,
        original_invoice_number: input.creditNoteDetails.originalInvoiceNumber || null,
      })
      .select()
      .single();

    if (detailError) throw detailError;

    // Create billing details
    if (input.creditNoteDetails.billingDetails?.length) {
      const { error: billingError } = await db
        .from("credit_note_details_billing_details")
        .insert(
          input.creditNoteDetails.billingDetails.map((b) => ({
            credit_note_details_id: detail.id,
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
        .from("credit_note_items")
        .insert(
          input.items.map((item) => ({
            credit_note_field_id: field.id,
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
        .from("credit_note_metadata")
        .insert({
          credit_note_field_id: field.id,
          notes: input.metadata.notes || null,
          terms: input.metadata.terms || null,
        });
      if (metaError) throw metaError;
    }

    return c.json({ creditNoteId: creditNote.id }, 201);
  } catch (error) {
    console.error("Error creating credit note:", error);
    return c.json({ error: "Failed to create credit note" }, 500);
  }
});

// Create credit note from invoice
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
    // Create credit note from invoice
    const { data: creditNote, error: cnError } = await db
      .from("credit_notes")
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

    if (cnError) throw cnError;

    // Create credit note fields
    const { data: field, error: fieldError } = await db
      .from("credit_note_fields")
      .insert({ credit_note_id: creditNote.id })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // Copy company details
    if (invf.company_details?.[0]) {
      const cd = invf.company_details[0];
      const { data: companyDetail, error: companyError } = await db
        .from("credit_note_company_details")
        .insert({
          credit_note_field_id: field.id,
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
          .from("credit_note_company_details_metadata")
          .insert(
            cd.metadata.map((m: { label: string; value: string }) => ({
              credit_note_company_details_id: companyDetail.id,
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
        .from("credit_note_client_details")
        .insert({
          credit_note_field_id: field.id,
          name: cld.name,
          address: cld.address,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      if (cld.metadata?.length) {
        const { error: metaError } = await db
          .from("credit_note_client_details_metadata")
          .insert(
            cld.metadata.map((m: { label: string; value: string }) => ({
              credit_note_client_details_id: clientDetail.id,
              label: m.label,
              value: m.value,
            }))
          );
        if (metaError) throw metaError;
      }
    }

    // Copy invoice details to credit note details
    if (invf.invoice_details?.[0]) {
      const invd = invf.invoice_details[0];
      const originalInvoiceNumber = `${invd.prefix}${invd.serial_number}`;

      const { data: detail, error: detailError } = await db
        .from("credit_note_details")
        .insert({
          credit_note_field_id: field.id,
          theme: invd.theme,
          currency: invd.currency,
          prefix: "CN-",
          serial_number: `${Date.now()}`,
          date: new Date().toISOString(),
          original_invoice_number: originalInvoiceNumber,
        })
        .select()
        .single();

      if (detailError) throw detailError;

      if (invd.billing_details?.length) {
        const { error: billingError } = await db
          .from("credit_note_details_billing_details")
          .insert(
            invd.billing_details.map((b: { label: string; type: string; value: string }) => ({
              credit_note_details_id: detail.id,
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
        .from("credit_note_items")
        .insert(
          invf.items.map((item: { name: string; description: string | null; quantity: number; unit_price: string }) => ({
            credit_note_field_id: field.id,
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
        .from("credit_note_metadata")
        .insert({
          credit_note_field_id: field.id,
          notes: invf.metadata[0].notes,
          terms: invf.metadata[0].terms,
        });
      if (metaError) throw metaError;
    }

    return c.json({
      creditNoteId: creditNote.id,
      invoiceId: invoice.id,
    }, 201);
  } catch (error) {
    console.error("Error creating credit note from invoice:", error);
    return c.json({ error: "Failed to create credit note from invoice" }, 500);
  }
});

// Update credit note status
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid credit note ID format" }, 400);
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

  const { data: creditNote, error } = await db
    .from("credit_notes")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Credit note not found" }, 404);
    }
    console.error("Error updating credit note status:", error);
    return c.json({ error: "Failed to update credit note status" }, 500);
  }

  return c.json({ success: true, creditNote });
});

// Delete a credit note
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid credit note ID format" }, 400);
  }

  // Check if it's a draft
  const { data: creditNote, error: fetchError } = await db
    .from("credit_notes")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Credit note not found" }, 404);
    }
    console.error("Error fetching credit note:", fetchError);
    return c.json({ error: "Failed to fetch credit note" }, 500);
  }

  if (creditNote.status !== "draft") {
    return c.json({ error: "Only draft credit notes can be deleted" }, 400);
  }

  const { error: deleteError } = await db
    .from("credit_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("Error deleting credit note:", deleteError);
    return c.json({ error: "Failed to delete credit note" }, 500);
  }

  return c.json({ success: true });
});

export default app;
