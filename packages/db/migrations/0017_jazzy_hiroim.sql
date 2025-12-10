CREATE TYPE "public"."acquisition_method" AS ENUM('purchase', 'donation', 'transfer', 'lease_to_own');--> statement-breakpoint
CREATE TYPE "public"."depreciation_method" AS ENUM('straight_line', 'declining_balance', 'double_declining');--> statement-breakpoint
CREATE TYPE "public"."depreciation_schedule_status" AS ENUM('scheduled', 'posted', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."disposal_method" AS ENUM('sale', 'scrapped', 'donation', 'trade_in');--> statement-breakpoint
CREATE TYPE "public"."fixed_asset_status" AS ENUM('draft', 'active', 'fully_depreciated', 'disposed');--> statement-breakpoint
ALTER TYPE "public"."source_document_type" ADD VALUE 'fixed_asset_depreciation';--> statement-breakpoint
ALTER TYPE "public"."source_document_type" ADD VALUE 'fixed_asset_disposal';--> statement-breakpoint
CREATE TABLE "fixed_asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"default_useful_life_months" integer,
	"default_depreciation_method" "depreciation_method",
	"default_asset_account_id" uuid,
	"default_depreciation_expense_account_id" uuid,
	"default_accumulated_depreciation_account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "fixed_asset_categories_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_depreciations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixed_asset_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"depreciation_amount" numeric(15, 2) NOT NULL,
	"accumulated_depreciation" numeric(15, 2) NOT NULL,
	"net_book_value" numeric(15, 2) NOT NULL,
	"journal_entry_id" uuid,
	"status" "depreciation_schedule_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp,
	CONSTRAINT "fixed_asset_depreciations_asset_year_unique" UNIQUE("fixed_asset_id","year")
);
--> statement-breakpoint
CREATE TABLE "fixed_asset_disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixed_asset_id" uuid NOT NULL,
	"disposal_date" date NOT NULL,
	"disposal_method" "disposal_method" NOT NULL,
	"proceeds" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_book_value_at_disposal" numeric(15, 2) NOT NULL,
	"gain_loss" numeric(15, 2) NOT NULL,
	"buyer_info" jsonb,
	"journal_entry_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_code" varchar(30) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"category_id" uuid,
	"acquisition_date" date NOT NULL,
	"acquisition_cost" numeric(15, 2) NOT NULL,
	"acquisition_method" "acquisition_method" DEFAULT 'purchase' NOT NULL,
	"vendor_id" uuid,
	"invoice_reference" varchar(100),
	"depreciation_method" "depreciation_method" DEFAULT 'straight_line' NOT NULL,
	"useful_life_months" integer NOT NULL,
	"salvage_value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"depreciation_start_date" date NOT NULL,
	"accumulated_depreciation" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_book_value" numeric(15, 2) NOT NULL,
	"last_depreciation_date" date,
	"asset_account_id" uuid NOT NULL,
	"depreciation_expense_account_id" uuid NOT NULL,
	"accumulated_depreciation_account_id" uuid NOT NULL,
	"status" "fixed_asset_status" DEFAULT 'draft' NOT NULL,
	"location" varchar(200),
	"serial_number" varchar(100),
	"warranty_expiry" date,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "fixed_assets_user_code_unique" UNIQUE("user_id","asset_code")
);
--> statement-breakpoint
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_default_asset_account_id_accounts_id_fk" FOREIGN KEY ("default_asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_default_depreciation_expense_account_id_accounts_id_fk" FOREIGN KEY ("default_depreciation_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_categories" ADD CONSTRAINT "fixed_asset_categories_default_accumulated_depreciation_account_id_accounts_id_fk" FOREIGN KEY ("default_accumulated_depreciation_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_depreciations" ADD CONSTRAINT "fixed_asset_depreciations_fixed_asset_id_fixed_assets_id_fk" FOREIGN KEY ("fixed_asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_depreciations" ADD CONSTRAINT "fixed_asset_depreciations_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_disposals" ADD CONSTRAINT "fixed_asset_disposals_fixed_asset_id_fixed_assets_id_fk" FOREIGN KEY ("fixed_asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_asset_disposals" ADD CONSTRAINT "fixed_asset_disposals_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_category_id_fixed_asset_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fixed_asset_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_asset_account_id_accounts_id_fk" FOREIGN KEY ("asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_depreciation_expense_account_id_accounts_id_fk" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_accumulated_depreciation_account_id_accounts_id_fk" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_asset_categories_user_id_idx" ON "fixed_asset_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fixed_asset_depreciations_asset_id_idx" ON "fixed_asset_depreciations" USING btree ("fixed_asset_id");--> statement-breakpoint
CREATE INDEX "fixed_asset_depreciations_year_idx" ON "fixed_asset_depreciations" USING btree ("year");--> statement-breakpoint
CREATE INDEX "fixed_asset_depreciations_status_idx" ON "fixed_asset_depreciations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fixed_asset_depreciations_journal_entry_id_idx" ON "fixed_asset_depreciations" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "fixed_asset_disposals_asset_id_idx" ON "fixed_asset_disposals" USING btree ("fixed_asset_id");--> statement-breakpoint
CREATE INDEX "fixed_asset_disposals_disposal_date_idx" ON "fixed_asset_disposals" USING btree ("disposal_date");--> statement-breakpoint
CREATE INDEX "fixed_asset_disposals_journal_entry_id_idx" ON "fixed_asset_disposals" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_user_id_idx" ON "fixed_assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_category_id_idx" ON "fixed_assets" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fixed_assets_acquisition_date_idx" ON "fixed_assets" USING btree ("acquisition_date");--> statement-breakpoint
CREATE INDEX "fixed_assets_vendor_id_idx" ON "fixed_assets" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_user_status_idx" ON "fixed_assets" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "fixed_assets_user_deleted_idx" ON "fixed_assets" USING btree ("user_id","deleted_at");