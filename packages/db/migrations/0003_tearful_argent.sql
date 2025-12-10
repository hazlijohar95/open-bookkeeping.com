ALTER TABLE "customers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD COLUMN "deleted_at" timestamp;