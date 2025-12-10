/**
 * Vendor Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/vendor.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Zod schemas for vendor operations
const metadataItemSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(500),
});

const createVendorSchema = z.object({
  // Basic Information
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),

  // Bank Details (all optional)
  bankName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankRoutingNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(20).optional(),

  // Tax Identifiers (all optional)
  taxId: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),

  // Payment Terms (all optional)
  paymentTermsDays: z.number().int().positive().max(365).optional(),
  preferredPaymentMethod: z.string().max(100).optional(),
  creditLimit: z.string().max(50).optional(),

  // Custom metadata
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateVendorSchema = z.object({
  // Basic Information
  name: z.string().min(1, "Name is required").max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),

  // Bank Details (all optional)
  bankName: z.string().max(255).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankRoutingNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(20).optional(),

  // Tax Identifiers (all optional)
  taxId: z.string().max(50).optional(),
  vatNumber: z.string().max(50).optional(),
  registrationNumber: z.string().max(100).optional(),

  // Payment Terms (all optional)
  paymentTermsDays: z.number().int().positive().max(365).optional().nullable(),
  preferredPaymentMethod: z.string().max(100).optional(),
  creditLimit: z.string().max(50).optional().nullable(),

  // Custom metadata
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// List all vendors with pagination
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: vendors, error, count } = await db
    .from("vendors")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching vendors:", error);
    return c.json({ error: "Failed to fetch vendors" }, 500);
  }

  return c.json({
    data: vendors,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Search vendors by name or email
app.get("/search", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query("query") || "";

  const { data: vendors, error } = await db
    .from("vendors")
    .select("id, name, email")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error("Error searching vendors:", error);
    return c.json({ error: "Failed to search vendors" }, 500);
  }

  return c.json(vendors);
});

// Get a single vendor by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const parseResult = uuidSchema.safeParse(id);
  if (!parseResult.success) {
    return c.json({ error: "Invalid vendor ID format" }, 400);
  }

  const { data: vendor, error } = await db
    .from("vendors")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Vendor not found" }, 404);
    }
    console.error("Error fetching vendor:", error);
    return c.json({ error: "Failed to fetch vendor" }, 500);
  }

  return c.json(vendor);
});

// Create a new vendor
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createVendorSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  const { data: vendor, error } = await db
    .from("vendors")
    .insert({
      user_id: user.id,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      website: input.website || null,
      bank_name: input.bankName || null,
      bank_account_number: input.bankAccountNumber || null,
      bank_routing_number: input.bankRoutingNumber || null,
      bank_swift_code: input.bankSwiftCode || null,
      tax_id: input.taxId || null,
      vat_number: input.vatNumber || null,
      registration_number: input.registrationNumber || null,
      payment_terms_days: input.paymentTermsDays || null,
      preferred_payment_method: input.preferredPaymentMethod || null,
      credit_limit: input.creditLimit || null,
      metadata: input.metadata || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating vendor:", error);
    return c.json({ error: "Failed to create vendor" }, 500);
  }

  return c.json(vendor, 201);
});

// Update an existing vendor
app.patch("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const uuidResult = uuidSchema.safeParse(id);
  if (!uuidResult.success) {
    return c.json({ error: "Invalid vendor ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = updateVendorSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  // Build update object (only include defined fields)
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.email !== undefined) updateData.email = input.email || null;
  if (input.phone !== undefined) updateData.phone = input.phone || null;
  if (input.address !== undefined) updateData.address = input.address || null;
  if (input.website !== undefined) updateData.website = input.website || null;
  if (input.bankName !== undefined) updateData.bank_name = input.bankName || null;
  if (input.bankAccountNumber !== undefined) updateData.bank_account_number = input.bankAccountNumber || null;
  if (input.bankRoutingNumber !== undefined) updateData.bank_routing_number = input.bankRoutingNumber || null;
  if (input.bankSwiftCode !== undefined) updateData.bank_swift_code = input.bankSwiftCode || null;
  if (input.taxId !== undefined) updateData.tax_id = input.taxId || null;
  if (input.vatNumber !== undefined) updateData.vat_number = input.vatNumber || null;
  if (input.registrationNumber !== undefined) updateData.registration_number = input.registrationNumber || null;
  if (input.paymentTermsDays !== undefined) updateData.payment_terms_days = input.paymentTermsDays;
  if (input.preferredPaymentMethod !== undefined) updateData.preferred_payment_method = input.preferredPaymentMethod || null;
  if (input.creditLimit !== undefined) updateData.credit_limit = input.creditLimit;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const { data: vendor, error } = await db
    .from("vendors")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Vendor not found" }, 404);
    }
    console.error("Error updating vendor:", error);
    return c.json({ error: "Failed to update vendor" }, 500);
  }

  return c.json(vendor);
});

// Delete a vendor (soft delete)
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const uuidResult = uuidSchema.safeParse(id);
  if (!uuidResult.success) {
    return c.json({ error: "Invalid vendor ID format" }, 400);
  }

  const { error, count } = await db
    .from("vendors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Error deleting vendor:", error);
    return c.json({ error: "Failed to delete vendor" }, 500);
  }

  if (count === 0) {
    return c.json({ error: "Vendor not found" }, 404);
  }

  return c.json({ success: true });
});

export default app;
