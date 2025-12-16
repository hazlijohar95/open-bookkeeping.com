-- Superadmin Dashboard Schema Migration
-- Run this manually if the regular migration fails

-- Create enums (will skip if they already exist)
DO $$ BEGIN
    CREATE TYPE "public"."admin_action_type" AS ENUM('user_role_changed', 'user_suspended', 'user_unsuspended', 'user_deleted', 'org_created', 'org_updated', 'org_deleted', 'org_subscription_changed', 'system_setting_updated', 'feature_flag_toggled', 'maintenance_mode_toggled', 'quota_override_set', 'quota_override_removed', 'api_key_revoked', 'session_terminated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'user', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."subscription_plan" AS ENUM('trial', 'free', 'starter', 'professional', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create organizations table
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "slug" varchar(100) NOT NULL,
    "logo_url" text,
    "email" text,
    "phone" varchar(20),
    "address" text,
    "city" varchar(100),
    "state" varchar(100),
    "postal_code" varchar(20),
    "country" varchar(2) DEFAULT 'MY',
    "registration_number" varchar(50),
    "tax_id" varchar(50),
    "sst_number" varchar(50),
    "stripe_customer_id" varchar(100),
    "stripe_subscription_id" varchar(100),
    "subscription_plan" "subscription_plan" DEFAULT 'trial' NOT NULL,
    "subscription_status" "subscription_status" DEFAULT 'active' NOT NULL,
    "trial_started_at" timestamp DEFAULT now(),
    "trial_ends_at" timestamp,
    "current_period_start" timestamp,
    "current_period_end" timestamp,
    "is_active" boolean DEFAULT true NOT NULL,
    "suspended_at" timestamp,
    "suspended_reason" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS "organization_members" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "role" "org_role" DEFAULT 'member' NOT NULL,
    "invited_by" uuid REFERENCES "users"("id"),
    "invited_at" timestamp,
    "accepted_at" timestamp,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "organization_members_unique" UNIQUE("organization_id","user_id")
);

-- Create organization_invitations table
CREATE TABLE IF NOT EXISTS "organization_invitations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "email" text NOT NULL,
    "role" "org_role" DEFAULT 'member' NOT NULL,
    "token" varchar(64) NOT NULL,
    "invited_by" uuid NOT NULL REFERENCES "users"("id"),
    "expires_at" timestamp NOT NULL,
    "accepted_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "organization_invitations_token_unique" UNIQUE("token")
);

-- Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "admin_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
    "action" "admin_action_type" NOT NULL,
    "description" text,
    "target_type" varchar(50),
    "target_id" uuid,
    "target_email" text,
    "previous_state" jsonb,
    "new_state" jsonb,
    "ip_address" varchar(45),
    "user_agent" text,
    "request_id" varchar(36),
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "key" varchar(100) NOT NULL,
    "name" varchar(255) NOT NULL,
    "description" text,
    "is_enabled" boolean DEFAULT false NOT NULL,
    "target_rules" jsonb,
    "created_by" uuid REFERENCES "users"("id"),
    "updated_by" uuid REFERENCES "users"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "maintenance_mode" boolean DEFAULT false NOT NULL,
    "maintenance_message" text,
    "maintenance_start_at" timestamp,
    "maintenance_end_at" timestamp,
    "announcement_enabled" boolean DEFAULT false NOT NULL,
    "announcement_message" text,
    "announcement_type" varchar(20) DEFAULT 'info',
    "announcement_expires_at" timestamp,
    "default_rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
    "default_rate_limit_per_hour" integer DEFAULT 1000 NOT NULL,
    "default_daily_invoice_limit" integer DEFAULT 50 NOT NULL,
    "default_daily_bill_limit" integer DEFAULT 50 NOT NULL,
    "default_daily_token_limit" integer DEFAULT 100000 NOT NULL,
    "session_timeout_minutes" integer DEFAULT 60 NOT NULL,
    "require_2fa" boolean DEFAULT false NOT NULL,
    "allow_new_signups" boolean DEFAULT true NOT NULL,
    "trial_duration_days" integer DEFAULT 7 NOT NULL,
    "updated_by" uuid REFERENCES "users"("id"),
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add columns to users table (if they don't exist)
DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "is_suspended" boolean DEFAULT false NOT NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "suspended_reason" text;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "suspended_by" uuid;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create indexes (if they don't exist)
CREATE INDEX IF NOT EXISTS "organization_invitations_org_idx" ON "organization_invitations" ("organization_id");
CREATE INDEX IF NOT EXISTS "organization_invitations_email_idx" ON "organization_invitations" ("email");
CREATE INDEX IF NOT EXISTS "organization_invitations_token_idx" ON "organization_invitations" ("token");
CREATE INDEX IF NOT EXISTS "organization_members_org_idx" ON "organization_members" ("organization_id");
CREATE INDEX IF NOT EXISTS "organization_members_user_idx" ON "organization_members" ("user_id");
CREATE INDEX IF NOT EXISTS "organization_members_role_idx" ON "organization_members" ("role");
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" ("slug");
CREATE INDEX IF NOT EXISTS "organizations_stripe_customer_idx" ON "organizations" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "organizations_subscription_status_idx" ON "organizations" ("subscription_status");
CREATE INDEX IF NOT EXISTS "organizations_is_active_idx" ON "organizations" ("is_active");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_idx" ON "admin_audit_logs" ("admin_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_idx" ON "admin_audit_logs" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_created_idx" ON "admin_audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "users_is_suspended_idx" ON "users" ("is_suspended");
CREATE INDEX IF NOT EXISTS "users_last_active_idx" ON "users" ("last_active_at");

-- Insert default system settings if not exists
INSERT INTO "system_settings" ("id", "maintenance_mode", "announcement_enabled")
SELECT gen_random_uuid(), false, false
WHERE NOT EXISTS (SELECT 1 FROM "system_settings" LIMIT 1);

SELECT 'Superadmin schema migration completed successfully!' as result;
