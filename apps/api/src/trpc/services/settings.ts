import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db, userSettings } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";

/**
 * Upsert user settings - handles race conditions safely
 * Uses transaction + ON CONFLICT for atomic operation
 */
async function upsertUserSettings(
  userId: string,
  updates: Record<string, unknown>
): Promise<typeof userSettings.$inferSelect> {
  return db.transaction(async (tx) => {
    // Try to update first (most common case)
    const [updated] = await tx
      .update(userSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning();

    if (updated) {
      return updated;
    }

    // If no rows updated, insert new record
    // Use ON CONFLICT to handle race condition where another request
    // inserted between our check and insert
    const [created] = await tx
      .insert(userSettings)
      .values({
        userId,
        ...updates,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...updates,
          updatedAt: new Date(),
        },
      })
      .returning();

    return created!;
  });
}

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

export const settingsRouter = router({
  // Get user settings (or create defaults)
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Try to find existing settings
    let settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    // If no settings exist, create defaults
    if (!settings) {
      const [newSettings] = await db
        .insert(userSettings)
        .values({
          userId,
          // Defaults are set by the schema
        })
        .returning();
      settings = newSettings;
    }

    return settings;
  }),

  // Update all settings (race-condition safe)
  update: protectedProcedure
    .input(updateSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertUserSettings(ctx.user.id, {
        ...input,
        defaultTaxRate: input.defaultTaxRate?.toString(),
      });
    }),

  // Update company profile only (race-condition safe)
  updateCompanyProfile: protectedProcedure
    .input(companyProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertUserSettings(ctx.user.id, input);
    }),

  // Update invoice defaults only (race-condition safe)
  updateInvoiceDefaults: protectedProcedure
    .input(invoiceDefaultsSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertUserSettings(ctx.user.id, {
        ...input,
        defaultTaxRate: input.defaultTaxRate?.toString(),
      });
    }),

  // Update notification settings only (race-condition safe)
  updateNotifications: protectedProcedure
    .input(notificationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertUserSettings(ctx.user.id, input);
    }),

  // Update appearance settings only (race-condition safe)
  updateAppearance: protectedProcedure
    .input(appearanceSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      return upsertUserSettings(ctx.user.id, input);
    }),

  // Get current user info (includes role for superadmin checks)
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      avatarUrl: ctx.user.avatarUrl,
      role: ctx.user.role,
      isSuspended: ctx.user.isSuspended,
    };
  }),
});
