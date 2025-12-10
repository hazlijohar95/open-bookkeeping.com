/**
 * Settings Routes for Supabase Edge Functions
 * Migrated from apps/api/src/trpc/services/settings.ts
 */

import { Hono } from "npm:hono@4";
import { z } from "npm:zod@3";
import { createDbClient } from "../../_shared/db.ts";

const app = new Hono();

// Validation schemas
const companyProfileSchema = z.object({
  companyName: z.string().max(255).optional().nullable(),
  companyAddress: z.string().max(1000).optional().nullable(),
  companyLogo: z.string().url().max(2000).optional().nullable(),
  companyTaxId: z.string().max(100).optional().nullable(),
  companyPhone: z.string().max(50).optional().nullable(),
  companyEmail: z.string().email().max(255).optional().nullable(),
  companyWebsite: z.string().url().max(500).optional().nullable(),
});

const invoiceDefaultsSchema = z.object({
  defaultCurrency: z.string().max(10).optional().nullable(),
  defaultPaymentTerms: z.string().max(500).optional().nullable(),
  defaultTaxRate: z.number().min(0).max(100).optional().nullable(),
  invoicePrefix: z.string().max(20).optional().nullable(),
  quotationPrefix: z.string().max(20).optional().nullable(),
  invoiceNotes: z.string().max(2000).optional().nullable(),
  invoiceTerms: z.string().max(2000).optional().nullable(),
});

const notificationSettingsSchema = z.object({
  emailOnOverdue: z.boolean().optional(),
  emailOnPayment: z.boolean().optional(),
  emailOnQuotationAccepted: z.boolean().optional(),
  overdueReminderDays: z.number().min(1).max(90).optional().nullable(),
});

const appearanceSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  dateFormat: z.string().max(20).optional().nullable(),
  numberFormat: z.string().max(20).optional().nullable(),
});

const updateSettingsSchema = z.object({
  ...companyProfileSchema.shape,
  ...invoiceDefaultsSchema.shape,
  ...notificationSettingsSchema.shape,
  ...appearanceSettingsSchema.shape,
});

// Helper to convert camelCase to snake_case
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const snakeCased: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeCased[snakeKey] = value;
  }
  return snakeCased;
}

// Helper to convert snake_case to camelCase for response
function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const camelCased: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelCased[camelKey] = value;
  }
  return camelCased;
}

// Get user settings (or create defaults)
app.get("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  // Try to find existing settings
  let { data: settings, error } = await db
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching settings:", error);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }

  // If no settings exist, create defaults
  if (!settings) {
    const { data: newSettings, error: insertError } = await db
      .from("user_settings")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating settings:", insertError);
      return c.json({ error: "Failed to create settings" }, 500);
    }

    settings = newSettings;
  }

  return c.json(toCamelCase(settings));
});

// Update all settings
app.put("/", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = updateSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;

  // Check if settings exist
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const updateData = {
    ...toSnakeCase(input),
    default_tax_rate: input.defaultTaxRate?.toString(),
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    // Update existing
    const { data, error } = await db
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating settings:", error);
      return c.json({ error: "Failed to update settings" }, 500);
    }
    result = data;
  } else {
    // Create new
    const { data, error } = await db
      .from("user_settings")
      .insert({ user_id: user.id, ...updateData })
      .select()
      .single();

    if (error) {
      console.error("Error creating settings:", error);
      return c.json({ error: "Failed to create settings" }, 500);
    }
    result = data;
  }

  return c.json(toCamelCase(result));
});

// Update company profile only
app.patch("/company-profile", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = companyProfileSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;
  const updateData = {
    ...toSnakeCase(input),
    updated_at: new Date().toISOString(),
  };

  // Check if settings exist
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let result;
  if (existing) {
    const { data, error } = await db
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating company profile:", error);
      return c.json({ error: "Failed to update company profile" }, 500);
    }
    result = data;
  } else {
    const { data, error } = await db
      .from("user_settings")
      .insert({ user_id: user.id, ...updateData })
      .select()
      .single();

    if (error) {
      console.error("Error creating settings:", error);
      return c.json({ error: "Failed to create settings" }, 500);
    }
    result = data;
  }

  return c.json(toCamelCase(result));
});

// Update invoice defaults only
app.patch("/invoice-defaults", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = invoiceDefaultsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;
  const updateData = {
    ...toSnakeCase(input),
    default_tax_rate: input.defaultTaxRate?.toString(),
    updated_at: new Date().toISOString(),
  };

  // Check if settings exist
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let result;
  if (existing) {
    const { data, error } = await db
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating invoice defaults:", error);
      return c.json({ error: "Failed to update invoice defaults" }, 500);
    }
    result = data;
  } else {
    const { data, error } = await db
      .from("user_settings")
      .insert({ user_id: user.id, ...updateData })
      .select()
      .single();

    if (error) {
      console.error("Error creating settings:", error);
      return c.json({ error: "Failed to create settings" }, 500);
    }
    result = data;
  }

  return c.json(toCamelCase(result));
});

// Update notification settings only
app.patch("/notifications", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = notificationSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;
  const updateData = {
    ...toSnakeCase(input),
    updated_at: new Date().toISOString(),
  };

  // Check if settings exist
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let result;
  if (existing) {
    const { data, error } = await db
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating notifications:", error);
      return c.json({ error: "Failed to update notifications" }, 500);
    }
    result = data;
  } else {
    const { data, error } = await db
      .from("user_settings")
      .insert({ user_id: user.id, ...updateData })
      .select()
      .single();

    if (error) {
      console.error("Error creating settings:", error);
      return c.json({ error: "Failed to create settings" }, 500);
    }
    result = data;
  }

  return c.json(toCamelCase(result));
});

// Update appearance settings only
app.patch("/appearance", async (c) => {
  const user = c.get("user");
  const db = createDbClient();

  const body = await c.req.json();
  const parseResult = appearanceSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({
      error: "Validation failed",
      details: parseResult.error.flatten()
    }, 400);
  }

  const input = parseResult.data;
  const updateData = {
    ...toSnakeCase(input),
    updated_at: new Date().toISOString(),
  };

  // Check if settings exist
  const { data: existing } = await db
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let result;
  if (existing) {
    const { data, error } = await db
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating appearance:", error);
      return c.json({ error: "Failed to update appearance" }, 500);
    }
    result = data;
  } else {
    const { data, error } = await db
      .from("user_settings")
      .insert({ user_id: user.id, ...updateData })
      .select()
      .single();

    if (error) {
      console.error("Error creating settings:", error);
      return c.json({ error: "Failed to create settings" }, 500);
    }
    result = data;
  }

  return c.json(toCamelCase(result));
});

export default app;
