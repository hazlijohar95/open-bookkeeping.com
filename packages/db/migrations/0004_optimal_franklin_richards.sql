CREATE TYPE "public"."einvoice_document_type" AS ENUM('invoice', 'credit_note', 'debit_note', 'refund_note', 'self_billed_invoice', 'self_billed_credit_note', 'self_billed_debit_note', 'self_billed_refund_note');--> statement-breakpoint
CREATE TYPE "public"."einvoice_submission_status" AS ENUM('pending', 'submitted', 'valid', 'invalid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."identification_scheme" AS ENUM('NRIC', 'BRN', 'PASSPORT', 'ARMY');--> statement-breakpoint
CREATE TYPE "public"."tax_category_code" AS ENUM('01', '02', '03', '04', '05', '06', 'E');--> statement-breakpoint
CREATE TABLE "einvoice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"auto_submit" boolean DEFAULT false NOT NULL,
	"tin" varchar(20),
	"brn" varchar(30),
	"identification_scheme" "identification_scheme",
	"msic_code" varchar(5),
	"msic_description" varchar(255),
	"sst_registration" varchar(50),
	"tourism_tax_registration" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "einvoice_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "einvoice_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"document_type" "einvoice_document_type" NOT NULL,
	"submission_uid" varchar(50),
	"document_uuid" varchar(50),
	"long_id" varchar(100),
	"status" "einvoice_submission_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"validated_at" timestamp,
	"cancelled_at" timestamp,
	"error_code" varchar(50),
	"error_message" text,
	"raw_request" jsonb,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "einvoice_status" varchar(20);--> statement-breakpoint
ALTER TABLE "einvoice_settings" ADD CONSTRAINT "einvoice_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einvoice_submissions" ADD CONSTRAINT "einvoice_submissions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "einvoice_submissions_invoice_id_idx" ON "einvoice_submissions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "einvoice_submissions_status_idx" ON "einvoice_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "einvoice_submissions_submission_uid_idx" ON "einvoice_submissions" USING btree ("submission_uid");--> statement-breakpoint
CREATE INDEX "einvoice_submissions_document_uuid_idx" ON "einvoice_submissions" USING btree ("document_uuid");