CREATE TYPE "public"."subscription_plan" AS ENUM('trial', 'free', 'starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled', 'past_due');--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"daily_invoice_limit" integer NOT NULL,
	"daily_bill_limit" integer NOT NULL,
	"daily_journal_entry_limit" integer NOT NULL,
	"daily_quotation_limit" integer NOT NULL,
	"daily_token_limit" integer NOT NULL,
	"features" jsonb,
	"monthly_price" numeric(10, 2),
	"yearly_price" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'MYR',
	"stripe_product_id" varchar(100),
	"stripe_price_id_monthly" varchar(100),
	"stripe_price_id_yearly" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"was_skipped" boolean DEFAULT false NOT NULL,
	"skipped_at" timestamp,
	"company_name" varchar(255),
	"industry_type" varchar(100),
	"business_size" varchar(20),
	"is_malaysia_based" boolean,
	"accounting_method" varchar(20),
	"fiscal_year_end_month" integer,
	"is_sst_registered" boolean,
	"main_pain_points" text,
	"referral_source" text,
	"onboarding_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "subscription_plan" DEFAULT 'trial' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"trial_started_at" timestamp DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp NOT NULL,
	"trial_days_total" integer DEFAULT 7 NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"feature_overrides" jsonb,
	"stripe_customer_id" varchar(100),
	"stripe_subscription_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_onboarding_user_idx" ON "user_onboarding" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_onboarding_completed_idx" ON "user_onboarding" USING btree ("is_completed");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_plan_idx" ON "user_subscriptions" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_subscriptions_trial_ends_idx" ON "user_subscriptions" USING btree ("trial_ends_at");