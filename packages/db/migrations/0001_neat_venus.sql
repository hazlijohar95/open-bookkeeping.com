CREATE TABLE "user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" text,
	"company_address" text,
	"company_logo" text,
	"company_tax_id" text,
	"company_phone" text,
	"company_email" text,
	"company_website" text,
	"default_currency" text DEFAULT 'MYR',
	"default_payment_terms" text,
	"default_tax_rate" numeric(5, 2),
	"invoice_prefix" text DEFAULT 'INV',
	"quotation_prefix" text DEFAULT 'QT',
	"invoice_notes" text,
	"invoice_terms" text,
	"email_on_overdue" boolean DEFAULT true,
	"email_on_payment" boolean DEFAULT true,
	"email_on_quotation_accepted" boolean DEFAULT true,
	"overdue_reminder_days" integer DEFAULT 7,
	"theme" text DEFAULT 'system',
	"date_format" text DEFAULT 'DD/MM/YYYY',
	"number_format" text DEFAULT '1,234.56',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
ALTER TABLE "quotations" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_user_id_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_vendor_id_idx" ON "invoices" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_user_id_idx" ON "quotations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quotations_customer_id_idx" ON "quotations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "quotations" USING btree ("status");