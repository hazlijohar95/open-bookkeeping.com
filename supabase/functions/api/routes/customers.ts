/**
 * Customer Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/customer.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Zod schemas for customer operations
const metadataItemSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(500),
});

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  metadata: z.array(metadataItemSchema).max(20).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// List all customers with pagination
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query();
  const { limit, offset } = paginationSchema.parse(query);

  const { data: customers, error, count } = await db
    .from("customers")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching customers:", error);
    return c.json({ error: "Failed to fetch customers" }, 500);
  }

  return c.json({
    data: customers,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Search customers by name or email
app.get("/search", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const query = c.req.query("query") || "";

  const { data: customers, error } = await db
    .from("customers")
    .select("id, name, email")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error("Error searching customers:", error);
    return c.json({ error: "Failed to search customers" }, 500);
  }

  return c.json(customers);
});

// Get a single customer by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const parseResult = uuidSchema.safeParse(id);
  if (!parseResult.success) {
    return c.json({ error: "Invalid customer ID format" }, 400);
  }

  const { data: customer, error } = await db
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Customer not found" }, 404);
    }
    console.error("Error fetching customer:", error);
    return c.json({ error: "Failed to fetch customer" }, 500);
  }

  return c.json(customer);
});

// Create a new customer
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createCustomerSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  const { data: customer, error } = await db
    .from("customers")
    .insert({
      user_id: user.id,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      metadata: input.metadata || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating customer:", error);
    return c.json({ error: "Failed to create customer" }, 500);
  }

  return c.json(customer, 201);
});

// Update an existing customer
app.patch("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const uuidResult = uuidSchema.safeParse(id);
  if (!uuidResult.success) {
    return c.json({ error: "Invalid customer ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = updateCustomerSchema.safeParse(body);

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
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const { data: customer, error } = await db
    .from("customers")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Customer not found" }, 404);
    }
    console.error("Error updating customer:", error);
    return c.json({ error: "Failed to update customer" }, 500);
  }

  return c.json(customer);
});

// Delete a customer (soft delete)
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  // Validate UUID format
  const uuidSchema = z.string().uuid();
  const uuidResult = uuidSchema.safeParse(id);
  if (!uuidResult.success) {
    return c.json({ error: "Invalid customer ID format" }, 400);
  }

  const { error, count } = await db
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Error deleting customer:", error);
    return c.json({ error: "Failed to delete customer" }, 500);
  }

  if (count === 0) {
    return c.json({ error: "Customer not found" }, 404);
  }

  return c.json({ success: true });
});

export default app;
