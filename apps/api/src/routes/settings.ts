/**
 * Settings REST Routes
 * Provides REST API endpoints for user settings management
 */

import { Hono } from "hono";
import { z } from "zod";
import { db, userSettings } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";
import {
  HTTP_STATUS,
  errorResponse,
  requireAuth,
} from "../lib/rest-route-factory";

export const settingsRoutes = new Hono();

// Validation schemas
const companyProfileSchema = z.object({
  companyName: z.string().max(200).optional().nullable(),
  companyAddress: z.string().max(500).optional().nullable(),
  companyLogo: z.string().url().optional().nullable(),
  companyTaxId: z.string().max(50).optional().nullable(),
  companyPhone: z.string().max(20).optional().nullable(),
  companyEmail: z.string().email().optional().nullable(),
  companyWebsite: z.string().url().optional().nullable(),
});

const invoiceDefaultsSchema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  defaultPaymentTerms: z.string().max(100).optional().nullable(),
  defaultTaxRate: z.string().optional().nullable(),
  invoicePrefix: z.string().max(10).optional(),
  quotationPrefix: z.string().max(10).optional(),
  invoiceNotes: z.string().max(1000).optional().nullable(),
  invoiceTerms: z.string().max(2000).optional().nullable(),
});

const notificationsSchema = z.object({
  emailOnOverdue: z.boolean().optional(),
  emailOnPayment: z.boolean().optional(),
  emailOnQuotationAccepted: z.boolean().optional(),
  overdueReminderDays: z.number().int().min(1).max(90).optional(),
});

const appearanceSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  dateFormat: z.string().max(20).optional(),
  numberFormat: z.string().max(20).optional(),
});

const fullSettingsSchema = z.object({
  ...companyProfileSchema.shape,
  ...invoiceDefaultsSchema.shape,
  ...notificationsSchema.shape,
  ...appearanceSchema.shape,
  // SST Settings
  sstBusinessCategory: z.string().max(50).optional().nullable(),
  sstRegistrationNumber: z.string().max(50).optional().nullable(),
  sstRegistrationDate: z.string().datetime().optional().nullable(),
  sstManualRevenue: z.string().optional().nullable(),
  sstUseManualRevenue: z.boolean().optional(),
});

// GET /settings - Get user settings
settingsRoutes.get("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    let settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    // Create default settings if none exist
    if (!settings) {
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId: user.id,
        })
        .returning();
      settings = newSettings;
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch settings");
  }
});

// PUT /settings - Update all settings
settingsRoutes.put("/", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = fullSettingsSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const data = validation.data;

    // Upsert settings
    const existing = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, user.id),
    });

    let settings;
    if (existing) {
      const [updated] = await db
        .update(userSettings)
        .set({
          ...data,
          sstRegistrationDate: data.sstRegistrationDate ? new Date(data.sstRegistrationDate) : null,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, user.id))
        .returning();
      settings = updated;
    } else {
      const [created] = await db
        .insert(userSettings)
        .values({
          userId: user.id,
          ...data,
          sstRegistrationDate: data.sstRegistrationDate ? new Date(data.sstRegistrationDate) : null,
        })
        .returning();
      settings = created;
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update settings");
  }
});

// PATCH /settings/company-profile - Update company profile
settingsRoutes.patch("/company-profile", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = companyProfileSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const [settings] = await db
      .update(userSettings)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, user.id))
      .returning();

    if (!settings) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Settings not found");
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error updating company profile:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update company profile");
  }
});

// PATCH /settings/invoice-defaults - Update invoice defaults
settingsRoutes.patch("/invoice-defaults", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = invoiceDefaultsSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const [settings] = await db
      .update(userSettings)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, user.id))
      .returning();

    if (!settings) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Settings not found");
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error updating invoice defaults:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update invoice defaults");
  }
});

// PATCH /settings/notifications - Update notification settings
settingsRoutes.patch("/notifications", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = notificationsSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const [settings] = await db
      .update(userSettings)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, user.id))
      .returning();

    if (!settings) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Settings not found");
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error updating notifications:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update notifications");
  }
});

// PATCH /settings/appearance - Update appearance settings
settingsRoutes.patch("/appearance", async (c) => {
  const authResult = await requireAuth(c);
  if (authResult instanceof Response) return authResult;
  const user = authResult;

  try {
    const body = await c.req.json();
    const validation = appearanceSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse(c, HTTP_STATUS.BAD_REQUEST, validation.error.message);
    }

    const [settings] = await db
      .update(userSettings)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, user.id))
      .returning();

    if (!settings) {
      return errorResponse(c, HTTP_STATUS.NOT_FOUND, "Settings not found");
    }

    return c.json(settings);
  } catch (error) {
    console.error("Error updating appearance:", error);
    return errorResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to update appearance");
  }
});
