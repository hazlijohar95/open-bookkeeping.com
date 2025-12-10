/**
 * Bill Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/bill.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Bill status enum
const billStatusSchema = z.enum(["draft", "pending", "paid", "overdue", "cancelled"]);

// Bill item schema
const billItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.string(),
  unitPrice: z.string(),
});

// Create bill schema
const createBillSchema = z.object({
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().min(1, "Bill number is required").max(100),
  description: z.string().max(1000).optional(),
  currency: z.string().length(3).default("MYR"),
  billDate: z.string(),
  dueDate: z.string().optional().nullable(),
  status: billStatusSchema.default("pending"),
  notes: z.string().max(2000).optional(),
  attachmentUrl: z.string().url().max(500).optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
});

// Update bill schema
const updateBillSchema = z.object({
  vendorId: z.string().uuid().optional().nullable(),
  billNumber: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  currency: z.string().length(3).optional(),
  billDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  status: billStatusSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  attachmentUrl: z.string().url().max(500).optional().nullable(),
  items: z.array(billItemSchema).optional(),
});

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// List all bills with pagination and filters
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const queryParams = c.req.query();
  const { limit, offset } = paginationSchema.parse(queryParams);
  const vendorId = queryParams.vendorId;
  const status = queryParams.status;
  const startDate = queryParams.startDate;
  const endDate = queryParams.endDate;

  let query = db
    .from("bills")
    .select(`
      *,
      vendor:vendors(id, name, email),
      items:bill_items(*)
    `, { count: "exact" })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (startDate) {
    query = query.gte("bill_date", startDate);
  }
  if (endDate) {
    query = query.lte("bill_date", endDate);
  }

  const { data: bills, error, count } = await query;

  if (error) {
    console.error("Error fetching bills:", error);
    return c.json({ error: "Failed to fetch bills" }, 500);
  }

  return c.json({
    data: bills,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get bills by vendor
app.get("/by-vendor/:vendorId", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const vendorId = c.req.param("vendorId");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(vendorId).success) {
    return c.json({ error: "Invalid vendor ID format" }, 400);
  }

  const queryParams = c.req.query();
  const { limit, offset } = paginationSchema.parse(queryParams);

  const { data: bills, error, count } = await db
    .from("bills")
    .select(`
      *,
      items:bill_items(*)
    `, { count: "exact" })
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching vendor bills:", error);
    return c.json({ error: "Failed to fetch bills" }, 500);
  }

  return c.json({
    data: bills,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// Get unpaid bills (for AP aging)
app.get("/unpaid", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const vendorId = c.req.query("vendorId");

  let query = db
    .from("bills")
    .select(`
      *,
      vendor:vendors(id, name),
      items:bill_items(*)
    `)
    .eq("user_id", user.id)
    .in("status", ["pending", "overdue"])
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  if (vendorId) {
    const uuidSchema = z.string().uuid();
    if (uuidSchema.safeParse(vendorId).success) {
      query = query.eq("vendor_id", vendorId);
    }
  }

  const { data: bills, error } = await query;

  if (error) {
    console.error("Error fetching unpaid bills:", error);
    return c.json({ error: "Failed to fetch unpaid bills" }, 500);
  }

  return c.json(bills);
});

// Get AP aging report
app.get("/aging-report", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const vendorId = c.req.query("vendorId");

  let query = db
    .from("bills")
    .select(`
      id,
      bill_number,
      status,
      due_date,
      created_at,
      vendor:vendors(id, name),
      items:bill_items(quantity, unit_price)
    `)
    .eq("user_id", user.id)
    .in("status", ["pending", "overdue"])
    .is("deleted_at", null);

  if (vendorId) {
    const uuidSchema = z.string().uuid();
    if (uuidSchema.safeParse(vendorId).success) {
      query = query.eq("vendor_id", vendorId);
    }
  }

  const { data: bills, error } = await query;

  if (error) {
    console.error("Error fetching aging report:", error);
    return c.json({ error: "Failed to fetch aging report" }, 500);
  }

  // Calculate aging buckets
  const now = new Date();
  const aging = {
    current: [] as typeof bills,
    "1-30": [] as typeof bills,
    "31-60": [] as typeof bills,
    "61-90": [] as typeof bills,
    "90+": [] as typeof bills,
  };

  bills?.forEach((bill) => {
    const dueDate = bill.due_date;
    if (!dueDate) {
      aging.current.push(bill);
      return;
    }

    const dueDateObj = new Date(dueDate);
    const daysPastDue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (daysPastDue <= 0) {
      aging.current.push(bill);
    } else if (daysPastDue <= 30) {
      aging["1-30"].push(bill);
    } else if (daysPastDue <= 60) {
      aging["31-60"].push(bill);
    } else if (daysPastDue <= 90) {
      aging["61-90"].push(bill);
    } else {
      aging["90+"].push(bill);
    }
  });

  return c.json(aging);
});

// Get a single bill by ID
app.get("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid bill ID format" }, 400);
  }

  const { data: bill, error } = await db
    .from("bills")
    .select(`
      *,
      vendor:vendors(*),
      items:bill_items(*)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Bill not found" }, 404);
    }
    console.error("Error fetching bill:", error);
    return c.json({ error: "Failed to fetch bill" }, 500);
  }

  return c.json(bill);
});

// Create a new bill
app.post("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = createBillSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  // Calculate total amount
  const totalAmount = input.items.reduce((sum, item) => {
    return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice);
  }, 0);

  try {
    // Create bill
    const { data: bill, error: billError } = await db
      .from("bills")
      .insert({
        user_id: user.id,
        vendor_id: input.vendorId || null,
        bill_number: input.billNumber,
        description: input.description || null,
        currency: input.currency,
        bill_date: input.billDate,
        due_date: input.dueDate || null,
        status: input.status,
        notes: input.notes || null,
        attachment_url: input.attachmentUrl || null,
        total_amount: String(totalAmount),
      })
      .select()
      .single();

    if (billError) throw billError;

    // Create bill items
    if (input.items.length) {
      const { error: itemsError } = await db
        .from("bill_items")
        .insert(
          input.items.map((item) => ({
            bill_id: bill.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          }))
        );
      if (itemsError) throw itemsError;
    }

    return c.json(bill, 201);
  } catch (error) {
    console.error("Error creating bill:", error);
    return c.json({ error: "Failed to create bill" }, 500);
  }
});

// Update an existing bill
app.patch("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid bill ID format" }, 400);
  }

  const body = await c.req.json();
  const parseResult = updateBillSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  // Build update object
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.vendorId !== undefined) updateData.vendor_id = input.vendorId;
  if (input.billNumber !== undefined) updateData.bill_number = input.billNumber;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.currency !== undefined) updateData.currency = input.currency;
  if (input.billDate !== undefined) updateData.bill_date = input.billDate;
  if (input.dueDate !== undefined) updateData.due_date = input.dueDate;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.attachmentUrl !== undefined) updateData.attachment_url = input.attachmentUrl;

  // Recalculate total if items are provided
  if (input.items) {
    const totalAmount = input.items.reduce((sum, item) => {
      return sum + parseFloat(item.quantity) * parseFloat(item.unitPrice);
    }, 0);
    updateData.total_amount = String(totalAmount);
  }

  try {
    const { data: bill, error } = await db
      .from("bills")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return c.json({ error: "Bill not found" }, 404);
      }
      throw error;
    }

    // Update items if provided
    if (input.items) {
      // Delete existing items
      await db.from("bill_items").delete().eq("bill_id", id);

      // Insert new items
      const { error: itemsError } = await db
        .from("bill_items")
        .insert(
          input.items.map((item) => ({
            bill_id: id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          }))
        );
      if (itemsError) throw itemsError;
    }

    return c.json(bill);
  } catch (error) {
    console.error("Error updating bill:", error);
    return c.json({ error: "Failed to update bill" }, 500);
  }
});

// Update bill status
app.patch("/:id/status", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid bill ID format" }, 400);
  }

  const body = await c.req.json();
  const statusSchema = z.object({
    status: billStatusSchema,
    paidAt: z.string().optional(),
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

  if (parseResult.data.status === "paid") {
    updateData.paid_at = parseResult.data.paidAt || new Date().toISOString();
  }

  const { data: bill, error } = await db
    .from("bills")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return c.json({ error: "Bill not found" }, 404);
    }
    console.error("Error updating bill status:", error);
    return c.json({ error: "Failed to update bill status" }, 500);
  }

  return c.json(bill);
});

// Delete a bill (soft delete)
app.delete("/:id", async (c) => {
  const user = c.get("user");
  const db = createDbClient();
  const id = c.req.param("id");

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: "Invalid bill ID format" }, 400);
  }

  const { error, count } = await db
    .from("bills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    console.error("Error deleting bill:", error);
    return c.json({ error: "Failed to delete bill" }, 500);
  }

  if (count === 0) {
    return c.json({ error: "Bill not found" }, 404);
  }

  return c.json({ success: true });
});

export default app;
