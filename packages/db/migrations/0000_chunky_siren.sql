CREATE TYPE "public"."billing_detail_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'success', 'error', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('local', 'server');--> statement-breakpoint
CREATE TYPE "public"."vault_category" AS ENUM('contracts', 'receipts', 'images', 'invoices', 'other');--> statement-breakpoint
CREATE TYPE "public"."quotation_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');--> statement-breakpoint
CREATE TYPE "public"."quotation_type" AS ENUM('local', 'server');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supabase_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"allowed_saving_data" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_id_unique" UNIQUE("supabase_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoice_client_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	CONSTRAINT "invoice_client_details_invoice_field_id_unique" UNIQUE("invoice_field_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_client_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_client_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_company_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"logo" text,
	"signature" text,
	CONSTRAINT "invoice_company_details_invoice_field_id_unique" UNIQUE("invoice_field_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_company_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_company_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_field_id" uuid NOT NULL,
	"theme" jsonb,
	"currency" text NOT NULL,
	"prefix" text NOT NULL,
	"serial_number" text NOT NULL,
	"date" timestamp NOT NULL,
	"due_date" timestamp,
	"payment_terms" text,
	CONSTRAINT "invoice_details_invoice_field_id_unique" UNIQUE("invoice_field_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_details_billing_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "billing_detail_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	CONSTRAINT "invoice_fields_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_field_id" uuid NOT NULL,
	"notes" text,
	"terms" text,
	CONSTRAINT "invoice_metadata_invoice_field_id_unique" UNIQUE("invoice_field_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_metadata_payment_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_metadata_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "invoice_type" DEFAULT 'server' NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"website" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_routing_number" text,
	"bank_swift_code" text,
	"tax_id" text,
	"vat_number" text,
	"registration_number" text,
	"payment_terms_days" integer,
	"preferred_payment_method" text,
	"credit_limit" numeric(15, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_document_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" "vault_category" DEFAULT 'other' NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"cover_image" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "blogs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quotation_client_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	CONSTRAINT "quotation_client_details_quotation_field_id_unique" UNIQUE("quotation_field_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_client_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_client_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_company_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"logo" text,
	"signature" text,
	CONSTRAINT "quotation_company_details_quotation_field_id_unique" UNIQUE("quotation_field_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_company_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_company_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_field_id" uuid NOT NULL,
	"theme" jsonb,
	"currency" text NOT NULL,
	"prefix" text NOT NULL,
	"serial_number" text NOT NULL,
	"date" timestamp NOT NULL,
	"valid_until" timestamp,
	"payment_terms" text,
	CONSTRAINT "quotation_details_quotation_field_id_unique" UNIQUE("quotation_field_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_details_billing_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "billing_detail_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	CONSTRAINT "quotation_fields_quotation_id_unique" UNIQUE("quotation_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_field_id" uuid NOT NULL,
	"notes" text,
	"terms" text,
	CONSTRAINT "quotation_metadata_quotation_field_id_unique" UNIQUE("quotation_field_id")
);
--> statement-breakpoint
CREATE TABLE "quotation_metadata_payment_information" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_metadata_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "quotation_type" DEFAULT 'server' NOT NULL,
	"status" "quotation_status" DEFAULT 'draft' NOT NULL,
	"valid_until" date,
	"converted_invoice_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "invoice_client_details" ADD CONSTRAINT "invoice_client_details_invoice_field_id_invoice_fields_id_fk" FOREIGN KEY ("invoice_field_id") REFERENCES "public"."invoice_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_client_details_metadata" ADD CONSTRAINT "invoice_client_details_metadata_invoice_client_details_id_invoice_client_details_id_fk" FOREIGN KEY ("invoice_client_details_id") REFERENCES "public"."invoice_client_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_company_details" ADD CONSTRAINT "invoice_company_details_invoice_field_id_invoice_fields_id_fk" FOREIGN KEY ("invoice_field_id") REFERENCES "public"."invoice_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_company_details_metadata" ADD CONSTRAINT "invoice_company_details_metadata_invoice_company_details_id_invoice_company_details_id_fk" FOREIGN KEY ("invoice_company_details_id") REFERENCES "public"."invoice_company_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_invoice_field_id_invoice_fields_id_fk" FOREIGN KEY ("invoice_field_id") REFERENCES "public"."invoice_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_details_billing_details" ADD CONSTRAINT "invoice_details_billing_details_invoice_details_id_invoice_details_id_fk" FOREIGN KEY ("invoice_details_id") REFERENCES "public"."invoice_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_fields" ADD CONSTRAINT "invoice_fields_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_field_id_invoice_fields_id_fk" FOREIGN KEY ("invoice_field_id") REFERENCES "public"."invoice_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_metadata" ADD CONSTRAINT "invoice_metadata_invoice_field_id_invoice_fields_id_fk" FOREIGN KEY ("invoice_field_id") REFERENCES "public"."invoice_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_metadata_payment_information" ADD CONSTRAINT "invoice_metadata_payment_information_invoice_metadata_id_invoice_metadata_id_fk" FOREIGN KEY ("invoice_metadata_id") REFERENCES "public"."invoice_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_metadata" ADD CONSTRAINT "customer_metadata_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_metadata" ADD CONSTRAINT "vendor_metadata_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_document_tags" ADD CONSTRAINT "vault_document_tags_document_id_vault_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."vault_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_documents" ADD CONSTRAINT "vault_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_client_details" ADD CONSTRAINT "quotation_client_details_quotation_field_id_quotation_fields_id_fk" FOREIGN KEY ("quotation_field_id") REFERENCES "public"."quotation_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_client_details_metadata" ADD CONSTRAINT "quotation_client_details_metadata_quotation_client_details_id_quotation_client_details_id_fk" FOREIGN KEY ("quotation_client_details_id") REFERENCES "public"."quotation_client_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_company_details" ADD CONSTRAINT "quotation_company_details_quotation_field_id_quotation_fields_id_fk" FOREIGN KEY ("quotation_field_id") REFERENCES "public"."quotation_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_company_details_metadata" ADD CONSTRAINT "quotation_company_details_metadata_quotation_company_details_id_quotation_company_details_id_fk" FOREIGN KEY ("quotation_company_details_id") REFERENCES "public"."quotation_company_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_details" ADD CONSTRAINT "quotation_details_quotation_field_id_quotation_fields_id_fk" FOREIGN KEY ("quotation_field_id") REFERENCES "public"."quotation_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_details_billing_details" ADD CONSTRAINT "quotation_details_billing_details_quotation_details_id_quotation_details_id_fk" FOREIGN KEY ("quotation_details_id") REFERENCES "public"."quotation_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_fields" ADD CONSTRAINT "quotation_fields_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_field_id_quotation_fields_id_fk" FOREIGN KEY ("quotation_field_id") REFERENCES "public"."quotation_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_metadata" ADD CONSTRAINT "quotation_metadata_quotation_field_id_quotation_fields_id_fk" FOREIGN KEY ("quotation_field_id") REFERENCES "public"."quotation_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_metadata_payment_information" ADD CONSTRAINT "quotation_metadata_payment_information_quotation_metadata_id_quotation_metadata_id_fk" FOREIGN KEY ("quotation_metadata_id") REFERENCES "public"."quotation_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_invoice_id_invoices_id_fk" FOREIGN KEY ("converted_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_user_id_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vendors_user_id_idx" ON "vendors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vendors_email_idx" ON "vendors" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vendors_name_idx" ON "vendors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "vault_document_tags_document_id_idx" ON "vault_document_tags" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "vault_document_tags_tag_idx" ON "vault_document_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "vault_documents_user_id_idx" ON "vault_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vault_documents_category_idx" ON "vault_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vault_documents_created_at_idx" ON "vault_documents" USING btree ("created_at");