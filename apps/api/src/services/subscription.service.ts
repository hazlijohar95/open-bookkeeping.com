import { eq } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import {
  userSubscriptions,
  userOnboarding,
  agentQuotas,
  PLAN_DEFAULTS,
  type SubscriptionPlan,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("subscription-service");

// Trial duration in days
const TRIAL_DAYS = 7;

// ============================================
// TYPES
// ============================================

export interface SubscriptionWithComputed {
  id: string;
  userId: string;
  plan: string;
  status: string;
  trialStartedAt: Date;
  trialEndsAt: Date;
  trialDaysTotal: number;
  featureOverrides: Record<string, boolean> | null;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields
  isTrialActive: boolean;
  trialDaysRemaining: number;
  effectivePlan: SubscriptionPlan;
}

export interface OnboardingStatus {
  id: string;
  userId: string;
  isCompleted: boolean;
  completedAt: Date | null;
  wasSkipped: boolean;
  skippedAt: Date | null;
  companyName: string | null;
  industryType: string | null;
  businessSize: string | null;
  isMalaysiaBased: boolean | null;
  accountingMethod: string | null;
  fiscalYearEndMonth: number | null;
  isSstRegistered: boolean | null;
  mainPainPoints: string | null;
  referralSource: string | null;
}

export interface PlanQuotas {
  dailyInvoiceLimit: number;
  dailyBillLimit: number;
  dailyJournalEntryLimit: number;
  dailyQuotationLimit: number;
  dailyTokenLimit: number;
  features: {
    aiChatEnabled: boolean;
    myInvoisEnabled: boolean;
    bankFeedsEnabled: boolean;
    multiCurrency: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  };
}

// ============================================
// SERVICE
// ============================================

export const subscriptionService = {
  /**
   * Initialize subscription and onboarding for a new user.
   * Called when a user signs up for the first time.
   */
  initializeForNewUser: async (userId: string): Promise<void> => {
    logger.info({ userId }, "Initializing subscription for new user");

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    // Check if already initialized
    const existing = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId),
    });

    if (existing) {
      logger.info({ userId }, "User already has subscription, skipping init");
      return;
    }

    // Create subscription record with trial
    await db.insert(userSubscriptions).values({
      userId,
      plan: "trial",
      status: "active",
      trialStartedAt: new Date(),
      trialEndsAt,
      trialDaysTotal: TRIAL_DAYS,
    });

    // Create onboarding record
    await db
      .insert(userOnboarding)
      .values({
        userId,
        isCompleted: false,
        wasSkipped: false,
      })
      .onConflictDoNothing();

    // Create agent_quotas with trial limits (full access)
    const trialPlan = PLAN_DEFAULTS.trial;
    await db
      .insert(agentQuotas)
      .values({
        userId,
        dailyInvoiceLimit: trialPlan.dailyInvoiceLimit,
        dailyBillLimit: trialPlan.dailyBillLimit,
        dailyJournalEntryLimit: trialPlan.dailyJournalEntryLimit,
        dailyQuotationLimit: trialPlan.dailyQuotationLimit,
        dailyTokenLimit: trialPlan.dailyTokenLimit,
        maxActionsPerMinute: 30,
        maxConcurrentWorkflows: 5,
        emergencyStopEnabled: false,
      })
      .onConflictDoNothing();

    logger.info({ userId, trialEndsAt }, "Subscription initialized with trial");
  },

  /**
   * Get user subscription with computed fields.
   * Returns null if user has no subscription.
   */
  getSubscription: async (
    userId: string
  ): Promise<SubscriptionWithComputed | null> => {
    const sub = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, userId),
    });

    if (!sub) return null;

    const now = new Date();
    const isTrialActive = sub.plan === "trial" && now < sub.trialEndsAt;
    const trialDaysRemaining = isTrialActive
      ? Math.max(
          0,
          Math.ceil(
            (sub.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    // Determine effective plan
    // If trial expired, effective plan is "free"
    let effectivePlan: SubscriptionPlan = sub.plan as SubscriptionPlan;
    if (sub.plan === "trial" && !isTrialActive) {
      effectivePlan = "free";
    }

    return {
      id: sub.id,
      userId: sub.userId,
      plan: sub.plan,
      status: sub.status,
      trialStartedAt: sub.trialStartedAt,
      trialEndsAt: sub.trialEndsAt,
      trialDaysTotal: sub.trialDaysTotal,
      featureOverrides: sub.featureOverrides as Record<string, boolean> | null,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      // Computed
      isTrialActive,
      trialDaysRemaining,
      effectivePlan,
    };
  },

  /**
   * Get onboarding status for a user.
   */
  getOnboardingStatus: async (
    userId: string
  ): Promise<OnboardingStatus | null> => {
    const onboarding = await db.query.userOnboarding.findFirst({
      where: eq(userOnboarding.userId, userId),
    });

    if (!onboarding) return null;

    return {
      id: onboarding.id,
      userId: onboarding.userId,
      isCompleted: onboarding.isCompleted,
      completedAt: onboarding.completedAt,
      wasSkipped: onboarding.wasSkipped,
      skippedAt: onboarding.skippedAt,
      companyName: onboarding.companyName,
      industryType: onboarding.industryType,
      businessSize: onboarding.businessSize,
      isMalaysiaBased: onboarding.isMalaysiaBased,
      accountingMethod: onboarding.accountingMethod,
      fiscalYearEndMonth: onboarding.fiscalYearEndMonth,
      isSstRegistered: onboarding.isSstRegistered,
      mainPainPoints: onboarding.mainPainPoints,
      referralSource: onboarding.referralSource,
    };
  },

  /**
   * Skip onboarding - marks as completed with wasSkipped=true.
   */
  skipOnboarding: async (userId: string): Promise<void> => {
    await db
      .update(userOnboarding)
      .set({
        wasSkipped: true,
        skippedAt: new Date(),
        isCompleted: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId));

    logger.info({ userId }, "Onboarding skipped");
  },

  /**
   * Complete onboarding with collected data.
   */
  completeOnboarding: async (
    userId: string,
    data: Partial<{
      companyName: string;
      industryType: string;
      businessSize: string;
      isMalaysiaBased: boolean;
      accountingMethod: string;
      fiscalYearEndMonth: number;
      isSstRegistered: boolean;
      mainPainPoints: string;
      referralSource: string;
    }>
  ): Promise<void> => {
    await db
      .update(userOnboarding)
      .set({
        ...data,
        isCompleted: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId));

    logger.info({ userId }, "Onboarding completed");
  },

  /**
   * Get quota limits for a specific plan.
   */
  getQuotasForPlan: (plan: SubscriptionPlan): PlanQuotas => {
    const planConfig = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.free;

    return {
      dailyInvoiceLimit: planConfig.dailyInvoiceLimit,
      dailyBillLimit: planConfig.dailyBillLimit,
      dailyJournalEntryLimit: planConfig.dailyJournalEntryLimit,
      dailyQuotationLimit: planConfig.dailyQuotationLimit,
      dailyTokenLimit: planConfig.dailyTokenLimit,
      features: planConfig.features,
    };
  },

  /**
   * Get effective quotas for a user based on their subscription.
   * This takes into account trial expiration.
   */
  getEffectiveQuotas: async (userId: string): Promise<PlanQuotas> => {
    const subscription = await subscriptionService.getSubscription(userId);
    const effectivePlan = subscription?.effectivePlan ?? "free";

    return subscriptionService.getQuotasForPlan(effectivePlan);
  },

  /**
   * Apply plan quotas to user's agent_quotas table.
   * Called when plan changes or trial expires.
   */
  applyPlanQuotas: async (
    userId: string,
    plan: SubscriptionPlan
  ): Promise<void> => {
    const planQuotas = subscriptionService.getQuotasForPlan(plan);

    await db
      .update(agentQuotas)
      .set({
        dailyInvoiceLimit: planQuotas.dailyInvoiceLimit,
        dailyBillLimit: planQuotas.dailyBillLimit,
        dailyJournalEntryLimit: planQuotas.dailyJournalEntryLimit,
        dailyQuotationLimit: planQuotas.dailyQuotationLimit,
        dailyTokenLimit: planQuotas.dailyTokenLimit,
        updatedAt: new Date(),
      })
      .where(eq(agentQuotas.userId, userId));

    logger.info({ userId, plan }, "Applied plan quotas to user");
  },

  /**
   * Check if a feature is enabled for the user.
   */
  isFeatureEnabled: async (
    userId: string,
    feature: keyof PlanQuotas["features"]
  ): Promise<boolean> => {
    const subscription = await subscriptionService.getSubscription(userId);

    // Check for override first
    if (subscription?.featureOverrides?.[feature] !== undefined) {
      return subscription.featureOverrides[feature];
    }

    // Use plan defaults
    const effectivePlan = subscription?.effectivePlan ?? "free";
    const planQuotas = subscriptionService.getQuotasForPlan(effectivePlan);

    return planQuotas.features[feature];
  },

  /**
   * Update onboarding data (partial update).
   */
  updateOnboardingData: async (
    userId: string,
    data: Partial<{
      companyName: string;
      industryType: string;
      businessSize: string;
      isMalaysiaBased: boolean;
      accountingMethod: string;
      fiscalYearEndMonth: number;
      isSstRegistered: boolean;
      mainPainPoints: string;
      referralSource: string;
    }>
  ): Promise<void> => {
    await db
      .update(userOnboarding)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userOnboarding.userId, userId));
  },
};

export default subscriptionService;
