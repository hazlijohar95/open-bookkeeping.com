import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db, userSettings } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";

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

  // Update all settings
  update: protectedProcedure
    .input(updateSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Check if settings exist
      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
      });

      if (existing) {
        // Update existing
        const [updated] = await db
          .update(userSettings)
          .set({
            ...input,
            defaultTaxRate: input.defaultTaxRate?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId))
          .returning();
        return updated;
      } else {
        // Create new
        const [created] = await db
          .insert(userSettings)
          .values({
            userId,
            ...input,
            defaultTaxRate: input.defaultTaxRate?.toString(),
          })
          .returning();
        return created;
      }
    }),

  // Update company profile only
  updateCompanyProfile: protectedProcedure
    .input(companyProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
      });

      if (existing) {
        const [updated] = await db
          .update(userSettings)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(userSettings)
          .values({
            userId,
            ...input,
          })
          .returning();
        return created;
      }
    }),

  // Update invoice defaults only
  updateInvoiceDefaults: protectedProcedure
    .input(invoiceDefaultsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
      });

      if (existing) {
        const [updated] = await db
          .update(userSettings)
          .set({
            ...input,
            defaultTaxRate: input.defaultTaxRate?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(userSettings)
          .values({
            userId,
            ...input,
            defaultTaxRate: input.defaultTaxRate?.toString(),
          })
          .returning();
        return created;
      }
    }),

  // Update notification settings only
  updateNotifications: protectedProcedure
    .input(notificationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
      });

      if (existing) {
        const [updated] = await db
          .update(userSettings)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(userSettings)
          .values({
            userId,
            ...input,
          })
          .returning();
        return created;
      }
    }),

  // Update appearance settings only
  updateAppearance: protectedProcedure
    .input(appearanceSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
      });

      if (existing) {
        const [updated] = await db
          .update(userSettings)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(userSettings)
          .values({
            userId,
            ...input,
          })
          .returning();
        return created;
      }
    }),
});
