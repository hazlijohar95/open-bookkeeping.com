CREATE TABLE "invoice_activities_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"changes" jsonb,
	"performed_by" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "invoice_items_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" numeric(15, 4) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"unit" varchar(20),
	"sku" varchar(100),
	"tax_rate" numeric(5, 2),
	"discount" numeric(15, 2),
	"sort_order" numeric DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payments_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(10) NOT NULL,
	"method" varchar(50),
	"reference" varchar(255),
	"paid_at" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoices_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"vendor_id" uuid,
	"type" varchar(20) DEFAULT 'server' NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"einvoice_status" varchar(20),
	"prefix" varchar(20) NOT NULL,
	"serial_number" varchar(50) NOT NULL,
	"currency" varchar(10) DEFAULT 'MYR' NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"due_date" timestamp,
	"payment_terms" text,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_due" numeric(15, 2) DEFAULT '0' NOT NULL,
	"theme" jsonb,
	"company_details" jsonb NOT NULL,
	"client_details" jsonb NOT NULL,
	"billing_details" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bill_items" ADD COLUMN "amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "subtotal" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "tax_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "tax_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "total" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "invoice_activities_v2" ADD CONSTRAINT "invoice_activities_v2_invoice_id_invoices_v2_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_activities_v2" ADD CONSTRAINT "invoice_activities_v2_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items_v2" ADD CONSTRAINT "invoice_items_v2_invoice_id_invoices_v2_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments_v2" ADD CONSTRAINT "invoice_payments_v2_invoice_id_invoices_v2_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments_v2" ADD CONSTRAINT "invoice_payments_v2_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices_v2" ADD CONSTRAINT "invoices_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices_v2" ADD CONSTRAINT "invoices_v2_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices_v2" ADD CONSTRAINT "invoices_v2_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_activities_v2_invoice_id_idx" ON "invoice_activities_v2" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_activities_v2_performed_at_idx" ON "invoice_activities_v2" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "invoice_items_v2_invoice_id_idx" ON "invoice_items_v2" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_v2_invoice_id_idx" ON "invoice_payments_v2" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_v2_paid_at_idx" ON "invoice_payments_v2" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_id_idx" ON "invoices_v2" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_v2_customer_id_idx" ON "invoices_v2" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "invoices_v2_vendor_id_idx" ON "invoices_v2" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "invoices_v2_status_idx" ON "invoices_v2" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_status_idx" ON "invoices_v2" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_created_idx" ON "invoices_v2" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_deleted_idx" ON "invoices_v2" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_customer_idx" ON "invoices_v2" USING btree ("user_id","customer_id");--> statement-breakpoint
CREATE INDEX "invoices_v2_prefix_serial_idx" ON "invoices_v2" USING btree ("prefix","serial_number");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_invoice_date_idx" ON "invoices_v2" USING btree ("user_id","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_due_date_idx" ON "invoices_v2" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "invoices_v2_user_status_total_idx" ON "invoices_v2" USING btree ("user_id","status","total");--> statement-breakpoint
CREATE INDEX "customers_user_deleted_idx" ON "customers" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "customers_user_name_idx" ON "customers" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "vendors_user_deleted_idx" ON "vendors" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "vendors_user_name_idx" ON "vendors" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "sst_transactions_user_date_idx" ON "sst_transactions" USING btree ("user_id","document_date");