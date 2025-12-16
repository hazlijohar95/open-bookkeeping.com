CREATE TYPE "public"."invoice_status_v2" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded');--> statement-breakpoint
ALTER TABLE "invoices_v2" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "invoices_v2" ALTER COLUMN "status" SET DATA TYPE "public"."invoice_status_v2" USING "status"::text::"public"."invoice_status_v2";--> statement-breakpoint
ALTER TABLE "invoices_v2" ALTER COLUMN "status" SET DEFAULT 'draft';