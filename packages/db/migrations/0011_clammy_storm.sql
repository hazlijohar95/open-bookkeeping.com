CREATE TYPE "public"."processing_status" AS ENUM('unprocessed', 'queued', 'processing', 'processed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."vault_category" ADD VALUE 'bills' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."vault_category" ADD VALUE 'statements' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."vault_category" ADD VALUE 'tax_documents' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "vault_processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"reducto_job_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"extracted_data" text,
	"matched_vendor_id" uuid,
	"created_vendor_id" uuid,
	"linked_bill_id" uuid,
	"confidence_score" numeric(3, 2),
	"processing_duration_ms" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "vault_documents" ADD COLUMN "storage_bucket" text DEFAULT 'vault' NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_documents" ADD COLUMN "processing_status" "processing_status" DEFAULT 'unprocessed' NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_documents" ADD COLUMN "last_processed_at" timestamp;--> statement-breakpoint
ALTER TABLE "vault_processing_jobs" ADD CONSTRAINT "vault_processing_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_processing_jobs" ADD CONSTRAINT "vault_processing_jobs_document_id_vault_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."vault_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vault_processing_jobs_user_id_idx" ON "vault_processing_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vault_processing_jobs_document_id_idx" ON "vault_processing_jobs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "vault_processing_jobs_status_idx" ON "vault_processing_jobs" USING btree ("status");