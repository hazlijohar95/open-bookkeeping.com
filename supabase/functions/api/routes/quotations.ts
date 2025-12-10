/**
 * Quotation Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/quotation.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Zod schemas for quotation creation
const metadataItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const billingDetailSchema = z.object({
  label: z.string(),
  type: z.enum(["fixed", "percentage"]),
  value: z.number(),
});

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
    theme: z.object({
      baseColor: z.string(),
      mode: z.enum(["dark", "light"]),
      template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
    }).optional(),
    currency: z.string(),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.string(),
    validUntil: z.string().nullable().optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(quotationItemSchema),
  metadata: z.object({
    notes: z.string().optional(),
    terms: z.string().optional(),
    paymentInformation: z.array(metadataItemSchema).optional(),
  }).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// List all quotations with pagination
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: quotationsData, error, count } = await db
    .from("quotations")
    .select(`
      *,
      customer:customers(*),
      quotation_fields(
        id,
        company_details:quotation_company_details(*),
        client_details:quotation_client_details(*),
        quotation_details:quotation_details(*),
        items:quotation_items(*),
        metadata:quotation_metadata(*)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching quotations:", error);
    return c.json({ error: "Failed to fetch quotations" }, 500);
  }

  return c.json({
    data: quotationsData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get a single quotation by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid quotation ID format" }, 400);
  }

  const { data: quotation, error } = await db
    .from("quotations")
    .select(`
      *,
      customer:customers(*),
      quotation_fields(
        id,
        company_details:quotation_company_details(
          *,
          metadata:quotation_company_details_metadata(*)
        ),
        client_details:quotation_client_details(
          *,
          metadata:quotation_client_details_metadata(*)
        ),
        quotation_details:quotation_details(
          *,
          billing_details:quotation_details_billing_details(*)
        ),
        items:quotation_items(*),
        metadata:quotation_metadata(
          *,
          payment_information:quotation_metadata_payment_information(*)
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Quotation not found" }, 404);
    }
    console.error("Error fetching quotation:", error);
    return c.json({ error: "Failed to fetch quotation" }, 500);
  }

  return c.json(quotation);
});

// Create a new quotation
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createQuotationSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  try {
    // Create quotation
    const { data: quotation, error: quotationError } = await db
      .from("quotations")
      .insert({
        user_id: user.id,
        customer_id: input.customerId || null,
        valid_until: input.validUntil || null,
        type: "server",
        status: "draft",
      })
      .select()
      .single();

    if (quotationError) throw quotationError;

    // Create quotation fields
    const { data: field, error: fieldError } = await db
      .from("quotation_fields")
      .insert({ quotation_id: quotation.id })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // Create company details
    const { data: companyDetail, error: companyError } = await db
      .from("quotation_company_details")
      .insert({
        quotation_field_id: field.id,
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
        .from("quotation_company_details_metadata")
        .insert(
          input.companyDetails.metadata.map((m) => ({
            quotation_company_details_id: companyDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create client details
    const { data: clientDetail, error: clientError } = await db
      .from("quotation_client_details")
      .insert({
        quotation_field_id: field.id,
        name: input.clientDetails.name,
        address: input.clientDetails.address,
      })
      .select()
      .single();

    if (clientError) throw clientError;

    // Create client metadata
    if (input.clientDetails.metadata?.length) {
      const { error: metaError } = await db
        .from("quotation_client_details_metadata")
        .insert(
          input.clientDetails.metadata.map((m) => ({
            quotation_client_details_id: clientDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create quotation details
    const { data: detail, error: detailError } = await db
      .from("quotation_details")
      .insert({
        quotation_field_id: field.id,
        theme: input.quotationDetails.theme || null,
        currency: input.quotationDetails.currency,
        prefix: input.quotationDetails.prefix,
        serial_number: input.quotationDetails.serialNumber,
        date: input.quotationDetails.date,
        valid_until: input.quotationDetails.validUntil || null,
        payment_terms: input.quotationDetails.paymentTerms || null,
      })
      .select()
      .single();

    if (detailError) throw detailError;

    // Create billing details
    if (input.quotationDetails.billingDetails?.length) {
      const { error: billingError } = await db
        .from("quotation_details_billing_details")
        .insert(
          input.quotationDetails.billingDetails.map((b) => ({
            quotation_details_id: detail.id,
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
        .from("quotation_items")
        .insert(
          input.items.map((item) => ({
            quotation_field_id: field.id,
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
      const { data: meta, error: metaError } = await db
        .from("quotation_metadata")
        .insert({
          quotation_field_id: field.id,
          notes: input.metadata.notes || null,
          terms: input.metadata.terms || null,
        })
        .select()
        .single();

      if (metaError) throw metaError;

      // Create payment information
      if (input.metadata.paymentInformation?.length) {
        const { error: paymentError } = await db
          .from("quotation_metadata_payment_information")
          .insert(
            input.metadata.paymentInformation.map((p) => ({
              quotation_metadata_id: meta.id,
              label: p.label,
              value: p.value,
            }))
          );
        if (paymentError) throw paymentError;
      }
    }

    return c.json({ quotationId: quotation.id }, 201);
  } catch (error) {
    console.error("Error creating quotation:", error);
    return c.json({ error: "Failed to create quotation" }, 500);
  }
});

// Update quotation status
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid quotation ID format" }, 400);
  }

  const body = await c.req.json();
  const statusSchema = z.object({
    status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]),
  });

  const parseResult = statusSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const { data: quotation, error } = await db
    .from("quotations")
    .update({
      status: parseResult.data.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Quotation not found" }, 404);
    }
    console.error("Error updating quotation status:", error);
    return c.json({ error: "Failed to update quotation status" }, 500);
  }

  return c.json({ success: true, quotation });
});

// Convert quotation to invoice
app.post("/:id/convert-to-invoice", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid quotation ID format" }, 400);
  }

  // Get the quotation with all related data
  const { data: quotation, error: fetchError } = await db
    .from("quotations")
    .select(`
      *,
      quotation_fields(
        company_details:quotation_company_details(
          *,
          metadata:quotation_company_details_metadata(*)
        ),
        client_details:quotation_client_details(
          *,
          metadata:quotation_client_details_metadata(*)
        ),
        quotation_details:quotation_details(
          *,
          billing_details:quotation_details_billing_details(*)
        ),
        items:quotation_items(*),
        metadata:quotation_metadata(
          *,
          payment_information:quotation_metadata_payment_information(*)
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      return c.json({ error: "Quotation not found" }, 404);
    }
    console.error("Error fetching quotation:", fetchError);
    return c.json({ error: "Failed to fetch quotation" }, 500);
  }

  if (quotation.status === "converted") {
    return c.json({ error: "Quotation already converted" }, 400);
  }

  const qf = quotation.quotation_fields?.[0];
  if (!qf) {
    return c.json({ error: "Quotation data is incomplete" }, 500);
  }

  try {
    // Create invoice from quotation data
    const { data: invoice, error: invoiceError } = await db
      .from("invoices")
      .insert({
        user_id: user.id,
        customer_id: quotation.customer_id,
        type: "server",
        status: "pending",
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create invoice fields
    const { data: field, error: fieldError } = await db
      .from("invoice_fields")
      .insert({ invoice_id: invoice.id })
      .select()
      .single();

    if (fieldError) throw fieldError;

    // Copy company details
    if (qf.company_details?.[0]) {
      const cd = qf.company_details[0];
      const { data: companyDetail, error: companyError } = await db
        .from("invoice_company_details")
        .insert({
          invoice_field_id: field.id,
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
          .from("invoice_company_details_metadata")
          .insert(
            cd.metadata.map((m: { label: string; value: string }) => ({
              invoice_company_details_id: companyDetail.id,
              label: m.label,
              value: m.value,
            }))
          );
        if (metaError) throw metaError;
      }
    }

    // Copy client details
    if (qf.client_details?.[0]) {
      const cld = qf.client_details[0];
      const { data: clientDetail, error: clientError } = await db
        .from("invoice_client_details")
        .insert({
          invoice_field_id: field.id,
          name: cld.name,
          address: cld.address,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      if (cld.metadata?.length) {
        const { error: metaError } = await db
          .from("invoice_client_details_metadata")
          .insert(
            cld.metadata.map((m: { label: string; value: string }) => ({
              invoice_client_details_id: clientDetail.id,
              label: m.label,
              value: m.value,
            }))
          );
        if (metaError) throw metaError;
      }
    }

    // Copy quotation details to invoice details
    if (qf.quotation_details?.[0]) {
      const qd = qf.quotation_details[0];
      const { data: detail, error: detailError } = await db
        .from("invoice_details")
        .insert({
          invoice_field_id: field.id,
          theme: qd.theme,
          currency: qd.currency,
          prefix: "INV-",
          serial_number: `${Date.now()}`,
          date: new Date().toISOString(),
          due_date: null,
          payment_terms: qd.payment_terms,
        })
        .select()
        .single();

      if (detailError) throw detailError;

      if (qd.billing_details?.length) {
        const { error: billingError } = await db
          .from("invoice_details_billing_details")
          .insert(
            qd.billing_details.map((b: { label: string; type: string; value: string }) => ({
              invoice_details_id: detail.id,
              label: b.label,
              type: b.type,
              value: b.value,
            }))
          );
        if (billingError) throw billingError;
      }
    }

    // Copy items
    if (qf.items?.length) {
      const { error: itemsError } = await db
        .from("invoice_items")
        .insert(
          qf.items.map((item: { name: string; description: string | null; quantity: number; unit_price: string }) => ({
            invoice_field_id: field.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))
        );
      if (itemsError) throw itemsError;
    }

    // Copy metadata
    if (qf.metadata?.[0]) {
      const qm = qf.metadata[0];
      const { data: meta, error: metaError } = await db
        .from("invoice_metadata")
        .insert({
          invoice_field_id: field.id,
          notes: qm.notes,
          terms: qm.terms,
        })
        .select()
        .single();

      if (metaError) throw metaError;

      if (qm.payment_information?.length) {
        const { error: paymentError } = await db
          .from("invoice_metadata_payment_information")
          .insert(
            qm.payment_information.map((p: { label: string; value: string }) => ({
              invoice_metadata_id: meta.id,
              label: p.label,
              value: p.value,
            }))
          );
        if (paymentError) throw paymentError;
      }
    }

    // Update quotation status to converted
    await db
      .from("quotations")
      .update({
        status: "converted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return c.json({
      quotationId: id,
      invoiceId: invoice.id,
    }, 201);
  } catch (error) {
    console.error("Error converting quotation to invoice:", error);
    return c.json({ error: "Failed to convert quotation to invoice" }, 500);
  }
});

// Delete a quotation (soft delete)
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid quotation ID format" }, 400);
  }

  const { error, count } = await db
    .from("quotations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Error deleting quotation:", error);
    return c.json({ error: "Failed to delete quotation" }, 500);
  }

  if (count === 0) {
    return c.json({ error: "Quotation not found" }, 404);
  }

  return c.json({ success: true });
});

export default app;
