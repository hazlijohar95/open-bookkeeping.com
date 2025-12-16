import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  varchar,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { subscriptionPlanEnum, subscriptionStatusEnum } from "./enums";

// ============================================
// SUBSCRIPTION PLANS (Reference Table)
// ============================================

/**
 * Defines quota limits for each subscription tier.
 * This is a reference table - seed with default plans.
 */
export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).unique().notNull(), // trial, free, starter, pro, enterprise
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),

  // Quota limits
  dailyInvoiceLimit: integer("daily_invoice_limit").notNull(),
  dailyBillLimit: integer("daily_bill_limit").notNull(),
  dailyJournalEntryLimit: integer("daily_journal_entry_limit").notNull(),
  dailyQuotationLimit: integer("daily_quotation_limit").notNull(),
  dailyTokenLimit: integer("daily_token_limit").notNull(),

  // Feature flags
  features: jsonb("features").$type<{
    aiChatEnabled: boolean;
    myInvoisEnabled: boolean;
    bankFeedsEnabled: boolean;
    multiCurrency: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  }>(),

  // Pricing (for future use)
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }),
  yearlyPrice: numeric("yearly_price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("MYR"),

  // Stripe IDs (for future payment integration)
  stripeProductId: varchar("stripe_product_id", { length: 100 }),
  stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 100 }),
  stripePriceIdYearly: varchar("stripe_price_id_yearly", { length: 100 }),

  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// USER SUBSCRIPTIONS
// ============================================

/**
 * Tracks each user's subscription status and trial info.
 * Every user gets one record, starting with trial.
 */
export const userSubscriptions = pgTable(
  "user_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),

    // Plan info
    plan: subscriptionPlanEnum("plan").default("trial").notNull(),
    status: subscriptionStatusEnum("status").default("active").notNull(),

    // Trial tracking
    trialStartedAt: timestamp("trial_started_at").defaultNow().notNull(),
    trialEndsAt: timestamp("trial_ends_at").notNull(),
    trialDaysTotal: integer("trial_days_total").default(7).notNull(),

    // Subscription dates (for future paid plans)
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),

    // Cancellation info
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),

    // Feature overrides for this specific user (nullable = use plan defaults)
    featureOverrides: jsonb("feature_overrides").$type<{
      aiChatEnabled?: boolean;
      myInvoisEnabled?: boolean;
      bankFeedsEnabled?: boolean;
      multiCurrency?: boolean;
      customBranding?: boolean;
    }>(),

    // Stripe customer/subscription IDs (for future)
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_subscriptions_user_idx").on(table.userId),
    index("user_subscriptions_plan_idx").on(table.plan),
    index("user_subscriptions_status_idx").on(table.status),
    index("user_subscriptions_trial_ends_idx").on(table.trialEndsAt),
  ]
);

// ============================================
// USER ONBOARDING
// ============================================

/**
 * Tracks onboarding completion and stores collected business info.
 * Every user gets one record when they sign up.
 */
export const userOnboarding = pgTable(
  "user_onboarding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique()
      .notNull(),

    // Onboarding completion status
    isCompleted: boolean("is_completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    wasSkipped: boolean("was_skipped").default(false).notNull(),
    skippedAt: timestamp("skipped_at"),

    // Collected business information
    companyName: varchar("company_name", { length: 255 }),
    industryType: varchar("industry_type", { length: 100 }),
    businessSize: varchar("business_size", { length: 20 }), // solo, 2-10, 11-50, 50+
    isMalaysiaBased: boolean("is_malaysia_based"),
    accountingMethod: varchar("accounting_method", { length: 20 }), // cash, accrual
    fiscalYearEndMonth: integer("fiscal_year_end_month"), // 1-12
    isSstRegistered: boolean("is_sst_registered"),
    mainPainPoints: text("main_pain_points"),
    referralSource: text("referral_source"), // How did you find us?

    // Chat session reference (for conversation history)
    onboardingSessionId: uuid("onboarding_session_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_onboarding_user_idx").on(table.userId),
    index("user_onboarding_completed_idx").on(table.isCompleted),
  ]
);

// ============================================
// RELATIONS
// ============================================

export const subscriptionPlansRelations = relations(
  subscriptionPlans,
  () => ({
    // Plans don't have direct relations, they're referenced by name
  })
);

export const userSubscriptionsRelations = relations(
  userSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, {
    fields: [userOnboarding.userId],
    references: [users.id],
  }),
}));

// ============================================
// DEFAULT PLAN CONFIGURATIONS
// ============================================

/**
 * Default plan configurations - use these when seeding the database
 * or when the subscriptionPlans table is empty.
 */
export const PLAN_DEFAULTS = {
  trial: {
    name: "trial",
    displayName: "Trial",
    description: "7-day free trial with full access to all features",
    dailyInvoiceLimit: 100,
    dailyBillLimit: 100,
    dailyJournalEntryLimit: 200,
    dailyQuotationLimit: 100,
    dailyTokenLimit: 1000000,
    features: {
      aiChatEnabled: true,
      myInvoisEnabled: true,
      bankFeedsEnabled: true,
      multiCurrency: true,
      customBranding: true,
      prioritySupport: false,
      apiAccess: true,
    },
  },
  free: {
    name: "free",
    displayName: "Free",
    description: "Basic free tier with essential features",
    dailyInvoiceLimit: 5,
    dailyBillLimit: 5,
    dailyJournalEntryLimit: 10,
    dailyQuotationLimit: 5,
    dailyTokenLimit: 10000,
    features: {
      aiChatEnabled: true,
      myInvoisEnabled: true,
      bankFeedsEnabled: false,
      multiCurrency: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  starter: {
    name: "starter",
    displayName: "Starter",
    description: "For small businesses getting started",
    dailyInvoiceLimit: 50,
    dailyBillLimit: 50,
    dailyJournalEntryLimit: 100,
    dailyQuotationLimit: 50,
    dailyTokenLimit: 500000,
    features: {
      aiChatEnabled: true,
      myInvoisEnabled: true,
      bankFeedsEnabled: true,
      multiCurrency: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
    },
    monthlyPrice: "49.00",
    yearlyPrice: "490.00",
  },
  professional: {
    name: "professional",
    displayName: "Professional",
    description: "For growing businesses",
    dailyInvoiceLimit: 200,
    dailyBillLimit: 200,
    dailyJournalEntryLimit: 500,
    dailyQuotationLimit: 200,
    dailyTokenLimit: 2000000,
    features: {
      aiChatEnabled: true,
      myInvoisEnabled: true,
      bankFeedsEnabled: true,
      multiCurrency: true,
      customBranding: true,
      prioritySupport: true,
      apiAccess: true,
    },
    monthlyPrice: "149.00",
    yearlyPrice: "1490.00",
  },
  enterprise: {
    name: "enterprise",
    displayName: "Enterprise",
    description: "For large organizations with custom needs",
    dailyInvoiceLimit: 1000,
    dailyBillLimit: 1000,
    dailyJournalEntryLimit: 2000,
    dailyQuotationLimit: 1000,
    dailyTokenLimit: 10000000,
    features: {
      aiChatEnabled: true,
      myInvoisEnabled: true,
      bankFeedsEnabled: true,
      multiCurrency: true,
      customBranding: true,
      prioritySupport: true,
      apiAccess: true,
    },
    monthlyPrice: "499.00",
    yearlyPrice: "4990.00",
  },
} as const;

// Note: SubscriptionPlan type is exported from enums.ts
export type PlanConfig = (typeof PLAN_DEFAULTS)[keyof typeof PLAN_DEFAULTS];
