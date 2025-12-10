/**
 * Invoice Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/invoice.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Zod schemas for invoice creation
const metadataItemSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const billingDetailSchema = z.object({
  label: z.string(),
  type: z.enum(["fixed", "percentage"]),
  value: z.number(),
  isSstTax: z.boolean().optional(),
  sstTaxType: z.enum(["sales_tax", "service_tax"]).optional(),
  sstRateCode: z.string().optional(),
});

const invoiceItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().uuid().optional(),
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
  invoiceDetails: z.object({
    theme: z.object({
      baseColor: z.string(),
      mode: z.enum(["dark", "light"]),
      template: z.enum(["default", "cynco", "classic", "zen", "executive"]).optional(),
    }).optional(),
    currency: z.string(),
    prefix: z.string(),
    serialNumber: z.string(),
    date: z.string(),
    dueDate: z.string().nullable().optional(),
    paymentTerms: z.string().optional(),
    billingDetails: z.array(billingDetailSchema).optional(),
  }),
  items: z.array(invoiceItemSchema),
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

// List all invoices with pagination
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  // Get invoices with related data
  const { data: invoicesData, error, count } = await db
    .from("invoices")
    .select(`
      *,
      customer:customers(*),
      invoice_fields(
        id,
        company_details:invoice_company_details(*),
        client_details:invoice_client_details(*),
        invoice_details:invoice_details(*),
        items:invoice_items(*),
        metadata:invoice_metadata(*)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching invoices:", error);
    return c.json({ error: "Failed to fetch invoices" }, 500);
  }

  return c.json({
    data: invoicesData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// List invoices (light version for tables)
app.get("/light", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: invoicesData, error, count } = await db
    .from("invoices")
    .select(`
      id,
      status,
      created_at,
      paid_at,
      customer:customers(id, name, email),
      invoice_fields(
        invoice_details:invoice_details(
          currency,
          prefix,
          serial_number,
          date,
          due_date
        ),
        items:invoice_items(quantity, unit_price)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching invoices:", error);
    return c.json({ error: "Failed to fetch invoices" }, 500);
  }

  return c.json({
    data: invoicesData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get invoices by customer
app.get("/by-customer/:customerId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const customerId = c.req.param("customerId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(customerId).success) {
    return c.json({ error: "Invalid customer ID format" }, 400);
  }

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: invoicesData, error, count } = await db
    .from("invoices")
    .select(`
      *,
      invoice_fields(
        invoice_details:invoice_details(*),
        items:invoice_items(*)
      )
    `, { count: "exact" })
    .eq("user_id", user.id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching customer invoices:", error);
    return c.json({ error: "Failed to fetch invoices" }, 500);
  }

  return c.json({
    data: invoicesData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get unpaid invoices by customer
app.get("/unpaid/:customerId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const customerId = c.req.param("customerId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(customerId).success) {
    return c.json({ error: "Invalid customer ID format" }, 400);
  }

  const { data: invoicesData, error } = await db
    .from("invoices")
    .select(`
      *,
      invoice_fields(
        invoice_details:invoice_details(*),
        items:invoice_items(*)
      )
    `)
    .eq("user_id", user.id)
    .eq("customer_id", customerId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching unpaid invoices:", error);
    return c.json({ error: "Failed to fetch invoices" }, 500);
  }

  return c.json(invoicesData);
});

// Get AR aging report
app.get("/aging-report", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const customerId = c.req.query("customerId");

  let query = db
    .from("invoices")
    .select(`
      id,
      status,
      created_at,
      customer:customers(id, name),
      invoice_fields(
        invoice_details:invoice_details(currency, due_date),
        items:invoice_items(quantity, unit_price)
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .is("deleted_at", null);

  if (customerId) {
    const uuidSchema = z.string().uuid();
    if (uuidSchema.safeParse(customerId).success) {
      query = query.eq("customer_id", customerId);
    }
  }

  const { data: invoicesData, error } = await query;

  if (error) {
    console.error("Error fetching aging report:", error);
    return c.json({ error: "Failed to fetch aging report" }, 500);
  }

  // Calculate aging buckets
  const now = new Date();
  const aging = {
    current: [] as typeof invoicesData,
    "1-30": [] as typeof invoicesData,
    "31-60": [] as typeof invoicesData,
    "61-90": [] as typeof invoicesData,
    "90+": [] as typeof invoicesData,
  };

  invoicesData?.forEach((invoice) => {
    const dueDate = invoice.invoice_fields?.[0]?.invoice_details?.[0]?.due_date;
    if (!dueDate) {
      aging.current.push(invoice);
      return;
    }

    const dueDateObj = new Date(dueDate);
    const daysPastDue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (daysPastDue <= 0) {
      aging.current.push(invoice);
    } else if (daysPastDue <= 30) {
      aging["1-30"].push(invoice);
    } else if (daysPastDue <= 60) {
      aging["31-60"].push(invoice);
    } else if (daysPastDue <= 90) {
      aging["61-90"].push(invoice);
    } else {
      aging["90+"].push(invoice);
    }
  });

  return c.json(aging);
});

// Get a single invoice by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid invoice ID format" }, 400);
  }

  const { data: invoice, error } = await db
    .from("invoices")
    .select(`
      *,
      customer:customers(*),
      invoice_fields(
        id,
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
        metadata:invoice_metadata(
          *,
          payment_information:invoice_metadata_payment_information(*)
        )
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Invoice not found" }, 404);
    }
    console.error("Error fetching invoice:", error);
    return c.json({ error: "Failed to fetch invoice" }, 500);
  }

  return c.json(invoice);
});

// Create a new invoice
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createInvoiceSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  try {
    // Create invoice
    const { data: invoice, error: invoiceError } = await db
      .from("invoices")
      .insert({
        user_id: user.id,
        customer_id: input.customerId || null,
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

    // Create company details
    const { data: companyDetail, error: companyError } = await db
      .from("invoice_company_details")
      .insert({
        invoice_field_id: field.id,
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
        .from("invoice_company_details_metadata")
        .insert(
          input.companyDetails.metadata.map((m) => ({
            invoice_company_details_id: companyDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create client details
    const { data: clientDetail, error: clientError } = await db
      .from("invoice_client_details")
      .insert({
        invoice_field_id: field.id,
        name: input.clientDetails.name,
        address: input.clientDetails.address,
      })
      .select()
      .single();

    if (clientError) throw clientError;

    // Create client metadata
    if (input.clientDetails.metadata?.length) {
      const { error: metaError } = await db
        .from("invoice_client_details_metadata")
        .insert(
          input.clientDetails.metadata.map((m) => ({
            invoice_client_details_id: clientDetail.id,
            label: m.label,
            value: m.value,
          }))
        );
      if (metaError) throw metaError;
    }

    // Create invoice details
    const { data: detail, error: detailError } = await db
      .from("invoice_details")
      .insert({
        invoice_field_id: field.id,
        theme: input.invoiceDetails.theme || null,
        currency: input.invoiceDetails.currency,
        prefix: input.invoiceDetails.prefix,
        serial_number: input.invoiceDetails.serialNumber,
        date: input.invoiceDetails.date,
        due_date: input.invoiceDetails.dueDate || null,
        payment_terms: input.invoiceDetails.paymentTerms || null,
      })
      .select()
      .single();

    if (detailError) throw detailError;

    // Create billing details
    if (input.invoiceDetails.billingDetails?.length) {
      const { error: billingError } = await db
        .from("invoice_details_billing_details")
        .insert(
          input.invoiceDetails.billingDetails.map((b) => ({
            invoice_details_id: detail.id,
            label: b.label,
            type: b.type,
            value: String(b.value),
            is_sst_tax: b.isSstTax || false,
            sst_tax_type: b.sstTaxType || null,
            sst_rate_code: b.sstRateCode || null,
          }))
        );
      if (billingError) throw billingError;
    }

    // Create items
    if (input.items.length) {
      const { error: itemsError } = await db
        .from("invoice_items")
        .insert(
          input.items.map((item) => ({
            invoice_field_id: field.id,
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
        .from("invoice_metadata")
        .insert({
          invoice_field_id: field.id,
          notes: input.metadata.notes || null,
          terms: input.metadata.terms || null,
        })
        .select()
        .single();

      if (metaError) throw metaError;

      // Create payment information
      if (input.metadata.paymentInformation?.length) {
        const { error: paymentError } = await db
          .from("invoice_metadata_payment_information")
          .insert(
            input.metadata.paymentInformation.map((p) => ({
              invoice_metadata_id: meta.id,
              label: p.label,
              value: p.value,
            }))
          );
        if (paymentError) throw paymentError;
      }
    }

    return c.json({ invoiceId: invoice.id }, 201);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return c.json({ error: "Failed to create invoice" }, 500);
  }
});

// Update invoice status
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid invoice ID format" }, 400);
  }

  const body = await c.req.json();
  const statusSchema = z.object({
    status: z.enum(["pending", "success", "error", "expired", "refunded"]),
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

  // Set paid_at if status is success
  if (parseResult.data.status === "success") {
    updateData.paid_at = new Date().toISOString();
  }

  const { data: invoice, error } = await db
    .from("invoices")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Invoice not found" }, 404);
    }
    console.error("Error updating invoice status:", error);
    return c.json({ error: "Failed to update invoice status" }, 500);
  }

  return c.json({ success: true, invoice });
});

// Delete an invoice (soft delete)
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid invoice ID format" }, 400);
  }

  const { error, count } = await db
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Error deleting invoice:", error);
    return c.json({ error: "Failed to delete invoice" }, 500);
  }

  if (count === 0) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  return c.json({ success: true });
});

export default app;
