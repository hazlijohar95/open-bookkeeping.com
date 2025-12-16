CREATE TABLE "quotation_activities_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"changes" jsonb,
	"performed_by" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "quotation_items_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
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
CREATE TABLE "quotations_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"type" varchar(20) DEFAULT 'server' NOT NULL,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"prefix" varchar(20) NOT NULL,
	"serial_number" varchar(50) NOT NULL,
	"currency" varchar(10) DEFAULT 'MYR' NOT NULL,
	"quotation_date" timestamp NOT NULL,
	"valid_until" timestamp,
	"payment_terms" text,
	"converted_to_invoice_id" uuid,
	"converted_at" timestamp,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"theme" jsonb,
	"company_details" jsonb NOT NULL,
	"client_details" jsonb NOT NULL,
	"billing_details" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "credit_note_activities_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"changes" jsonb,
	"performed_by" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "credit_note_items_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
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
CREATE TABLE "credit_notes_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"vendor_id" uuid,
	"original_invoice_id" uuid,
	"original_invoice_number" varchar(100),
	"type" varchar(20) DEFAULT 'server' NOT NULL,
	"status" "credit_note_status" DEFAULT 'draft' NOT NULL,
	"reason" "note_reason" NOT NULL,
	"reason_description" text,
	"prefix" varchar(20) DEFAULT 'CN-' NOT NULL,
	"serial_number" varchar(50) NOT NULL,
	"currency" varchar(10) DEFAULT 'MYR' NOT NULL,
	"credit_note_date" timestamp NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_applied" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_remaining" numeric(15, 2) DEFAULT '0' NOT NULL,
	"theme" jsonb,
	"company_details" jsonb NOT NULL,
	"client_details" jsonb NOT NULL,
	"billing_details" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "debit_note_activities_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"changes" jsonb,
	"performed_by" uuid,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "debit_note_items_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" uuid NOT NULL,
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
CREATE TABLE "debit_notes_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_id" uuid,
	"vendor_id" uuid,
	"original_invoice_id" uuid,
	"original_invoice_number" varchar(100),
	"type" varchar(20) DEFAULT 'server' NOT NULL,
	"status" "debit_note_status" DEFAULT 'draft' NOT NULL,
	"reason" "note_reason" NOT NULL,
	"reason_description" text,
	"prefix" varchar(20) DEFAULT 'DN-' NOT NULL,
	"serial_number" varchar(50) NOT NULL,
	"currency" varchar(10) DEFAULT 'MYR' NOT NULL,
	"debit_note_date" timestamp NOT NULL,
	"subtotal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_applied" numeric(15, 2) DEFAULT '0' NOT NULL,
	"amount_remaining" numeric(15, 2) DEFAULT '0' NOT NULL,
	"theme" jsonb,
	"company_details" jsonb NOT NULL,
	"client_details" jsonb NOT NULL,
	"billing_details" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "quotation_activities_v2" ADD CONSTRAINT "quotation_activities_v2_quotation_id_quotations_v2_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_activities_v2" ADD CONSTRAINT "quotation_activities_v2_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items_v2" ADD CONSTRAINT "quotation_items_v2_quotation_id_quotations_v2_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations_v2" ADD CONSTRAINT "quotations_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations_v2" ADD CONSTRAINT "quotations_v2_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations_v2" ADD CONSTRAINT "quotations_v2_converted_to_invoice_id_invoices_v2_id_fk" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "public"."invoices_v2"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_activities_v2" ADD CONSTRAINT "credit_note_activities_v2_credit_note_id_credit_notes_v2_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_activities_v2" ADD CONSTRAINT "credit_note_activities_v2_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_items_v2" ADD CONSTRAINT "credit_note_items_v2_credit_note_id_credit_notes_v2_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes_v2" ADD CONSTRAINT "credit_notes_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes_v2" ADD CONSTRAINT "credit_notes_v2_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes_v2" ADD CONSTRAINT "credit_notes_v2_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes_v2" ADD CONSTRAINT "credit_notes_v2_original_invoice_id_invoices_v2_id_fk" FOREIGN KEY ("original_invoice_id") REFERENCES "public"."invoices_v2"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_activities_v2" ADD CONSTRAINT "debit_note_activities_v2_debit_note_id_debit_notes_v2_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_activities_v2" ADD CONSTRAINT "debit_note_activities_v2_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_items_v2" ADD CONSTRAINT "debit_note_items_v2_debit_note_id_debit_notes_v2_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes_v2" ADD CONSTRAINT "debit_notes_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes_v2" ADD CONSTRAINT "debit_notes_v2_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes_v2" ADD CONSTRAINT "debit_notes_v2_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes_v2" ADD CONSTRAINT "debit_notes_v2_original_invoice_id_invoices_v2_id_fk" FOREIGN KEY ("original_invoice_id") REFERENCES "public"."invoices_v2"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotation_activities_v2_quotation_id_idx" ON "quotation_activities_v2" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotation_activities_v2_performed_at_idx" ON "quotation_activities_v2" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "quotation_items_v2_quotation_id_idx" ON "quotation_items_v2" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_id_idx" ON "quotations_v2" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quotations_v2_customer_id_idx" ON "quotations_v2" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotations_v2_status_idx" ON "quotations_v2" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_status_idx" ON "quotations_v2" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_created_idx" ON "quotations_v2" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_deleted_idx" ON "quotations_v2" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_customer_idx" ON "quotations_v2" USING btree ("user_id","customer_id");--> statement-breakpoint
CREATE INDEX "quotations_v2_prefix_serial_idx" ON "quotations_v2" USING btree ("prefix","serial_number");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_quotation_date_idx" ON "quotations_v2" USING btree ("user_id","quotation_date");--> statement-breakpoint
CREATE INDEX "quotations_v2_user_valid_until_idx" ON "quotations_v2" USING btree ("user_id","valid_until");--> statement-breakpoint
CREATE INDEX "quotations_v2_converted_invoice_idx" ON "quotations_v2" USING btree ("converted_to_invoice_id");--> statement-breakpoint
CREATE INDEX "credit_note_activities_v2_credit_note_id_idx" ON "credit_note_activities_v2" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_note_activities_v2_performed_at_idx" ON "credit_note_activities_v2" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "credit_note_items_v2_credit_note_id_idx" ON "credit_note_items_v2" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_id_idx" ON "credit_notes_v2" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_customer_id_idx" ON "credit_notes_v2" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_vendor_id_idx" ON "credit_notes_v2" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_status_idx" ON "credit_notes_v2" USING btree ("status");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_status_idx" ON "credit_notes_v2" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_created_idx" ON "credit_notes_v2" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_deleted_idx" ON "credit_notes_v2" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_customer_idx" ON "credit_notes_v2" USING btree ("user_id","customer_id");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_prefix_serial_idx" ON "credit_notes_v2" USING btree ("prefix","serial_number");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_original_invoice_idx" ON "credit_notes_v2" USING btree ("original_invoice_id");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_date_idx" ON "credit_notes_v2" USING btree ("user_id","credit_note_date");--> statement-breakpoint
CREATE INDEX "credit_notes_v2_user_reason_idx" ON "credit_notes_v2" USING btree ("user_id","reason");--> statement-breakpoint
CREATE INDEX "debit_note_activities_v2_debit_note_id_idx" ON "debit_note_activities_v2" USING btree ("debit_note_id");--> statement-breakpoint
CREATE INDEX "debit_note_activities_v2_performed_at_idx" ON "debit_note_activities_v2" USING btree ("performed_at");--> statement-breakpoint
CREATE INDEX "debit_note_items_v2_debit_note_id_idx" ON "debit_note_items_v2" USING btree ("debit_note_id");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_id_idx" ON "debit_notes_v2" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_customer_id_idx" ON "debit_notes_v2" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_vendor_id_idx" ON "debit_notes_v2" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_status_idx" ON "debit_notes_v2" USING btree ("status");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_status_idx" ON "debit_notes_v2" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_created_idx" ON "debit_notes_v2" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_deleted_idx" ON "debit_notes_v2" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_customer_idx" ON "debit_notes_v2" USING btree ("user_id","customer_id");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_prefix_serial_idx" ON "debit_notes_v2" USING btree ("prefix","serial_number");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_original_invoice_idx" ON "debit_notes_v2" USING btree ("original_invoice_id");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_date_idx" ON "debit_notes_v2" USING btree ("user_id","debit_note_date");--> statement-breakpoint
CREATE INDEX "debit_notes_v2_user_reason_idx" ON "debit_notes_v2" USING btree ("user_id","reason");