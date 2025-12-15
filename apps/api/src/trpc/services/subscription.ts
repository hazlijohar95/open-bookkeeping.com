import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { subscriptionService } from "../../services/subscription.service";
import { db, userSettings } from "@open-bookkeeping/db";
import { eq } from "drizzle-orm";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const completeOnboardingSchema = z.object({
  companyName: z.string().max(255).optional(),
  industryType: z.string().max(100).optional(),
  businessSize: z.enum(["solo", "2-10", "11-50", "50+"]).optional(),
  isMalaysiaBased: z.boolean().optional(),
  accountingMethod: z.enum(["cash", "accrual"]).optional(),
  fiscalYearEndMonth: z.number().min(1).max(12).optional(),
  isSstRegistered: z.boolean().optional(),
  mainPainPoints: z.string().optional(),
  referralSource: z.string().optional(),
});

const updateOnboardingDataSchema = z.object({
  companyName: z.string().max(255).optional(),
  industryType: z.string().max(100).optional(),
  businessSize: z.string().max(20).optional(),
  isMalaysiaBased: z.boolean().optional(),
  accountingMethod: z.string().max(20).optional(),
  fiscalYearEndMonth: z.number().min(1).max(12).optional(),
  isSstRegistered: z.boolean().optional(),
  mainPainPoints: z.string().optional(),
  referralSource: z.string().optional(),
});

// ============================================
// ROUTER
// ============================================

export const subscriptionRouter = router({
  // ==========================================
  // SUBSCRIPTION
  // ==========================================

  /**
   * Get current user's subscription with computed fields.
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    return subscriptionService.getSubscription(ctx.user.id);
  }),

  /**
   * Get effective quotas based on subscription tier.
   */
  getEffectiveQuotas: protectedProcedure.query(async ({ ctx }) => {
    return subscriptionService.getEffectiveQuotas(ctx.user.id);
  }),

  /**
   * Check if a feature is enabled for the user.
   */
  isFeatureEnabled: protectedProcedure
    .input(
      z.object({
        feature: z.enum([
          "aiChatEnabled",
          "myInvoisEnabled",
          "bankFeedsEnabled",
          "multiCurrency",
          "customBranding",
          "prioritySupport",
          "apiAccess",
        ]),
      })
    )
    .query(async ({ ctx, input }) => {
      return subscriptionService.isFeatureEnabled(ctx.user.id, input.feature);
    }),

  // ==========================================
  // ONBOARDING
  // ==========================================

  /**
   * Get onboarding status for the user.
   */
  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    return subscriptionService.getOnboardingStatus(ctx.user.id);
  }),

  /**
   * Initialize subscription for a new user.
   * Called after first login if no subscription exists.
   */
  initializeNewUser: protectedProcedure.mutation(async ({ ctx }) => {
    await subscriptionService.initializeForNewUser(ctx.user.id);
    return { initialized: true };
  }),

  /**
   * Skip onboarding entirely.
   */
  skipOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await subscriptionService.skipOnboarding(ctx.user.id);
    return { skipped: true };
  }),

  /**
   * Complete onboarding with collected data.
   * Also syncs company name to user settings.
   */
  completeOnboarding: protectedProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      // Complete onboarding
      await subscriptionService.completeOnboarding(ctx.user.id, input);

      // Sync company name to user settings if provided
      if (input.companyName) {
        await db
          .update(userSettings)
          .set({
            companyName: input.companyName,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.userId, ctx.user.id));
      }

      return { completed: true };
    }),

  /**
   * Update onboarding data (partial update).
   * Used by the AI during onboarding conversation.
   */
  updateOnboardingData: protectedProcedure
    .input(updateOnboardingDataSchema)
    .mutation(async ({ ctx, input }) => {
      await subscriptionService.updateOnboardingData(ctx.user.id, input);
      return { updated: true };
    }),
});

export default subscriptionRouter;
