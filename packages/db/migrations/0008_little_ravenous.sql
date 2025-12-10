CREATE TYPE "public"."sst_tax_type" AS ENUM('sales_tax', 'service_tax');--> statement-breakpoint
CREATE TABLE "sst_return_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tax_period_code" varchar(7) NOT NULL,
	"tax_period_start" timestamp NOT NULL,
	"tax_period_end" timestamp NOT NULL,
	"total_sales_tax" numeric(15, 2) NOT NULL,
	"total_service_tax" numeric(15, 2) NOT NULL,
	"total_taxable_amount" numeric(15, 2) NOT NULL,
	"transaction_count" numeric NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"reference_number" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sst_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_type" varchar(20) NOT NULL,
	"document_id" uuid NOT NULL,
	"document_number" varchar(50),
	"tax_type" "sst_tax_type" NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"taxable_amount" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) NOT NULL,
	"tax_period" varchar(7) NOT NULL,
	"customer_name" text,
	"customer_tin" varchar(50),
	"document_date" timestamp NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_details_billing_details" ADD COLUMN "is_sst_tax" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "invoice_details_billing_details" ADD COLUMN "sst_tax_type" "sst_tax_type";--> statement-breakpoint
ALTER TABLE "invoice_details_billing_details" ADD COLUMN "sst_rate_code" varchar(20);--> statement-breakpoint
ALTER TABLE "sst_return_submissions" ADD CONSTRAINT "sst_return_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sst_transactions" ADD CONSTRAINT "sst_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sst_return_submissions_user_id_idx" ON "sst_return_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sst_return_submissions_period_idx" ON "sst_return_submissions" USING btree ("user_id","tax_period_code");--> statement-breakpoint
CREATE INDEX "sst_transactions_user_id_idx" ON "sst_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sst_transactions_user_period_idx" ON "sst_transactions" USING btree ("user_id","tax_period");--> statement-breakpoint
CREATE INDEX "sst_transactions_document_idx" ON "sst_transactions" USING btree ("document_type","document_id");--> statement-breakpoint
CREATE INDEX "sst_transactions_user_tax_type_idx" ON "sst_transactions" USING btree ("user_id","tax_type");