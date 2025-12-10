ALTER TABLE "user_settings" ADD COLUMN "sst_business_category" varchar(50);--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "sst_registration_number" varchar(50);--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "sst_registration_date" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "sst_manual_revenue" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "sst_use_manual_revenue" boolean DEFAULT false;