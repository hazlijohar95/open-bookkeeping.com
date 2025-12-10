CREATE TYPE "public"."credit_note_status" AS ENUM('draft', 'issued', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."credit_note_type" AS ENUM('local', 'server');--> statement-breakpoint
CREATE TYPE "public"."debit_note_status" AS ENUM('draft', 'issued', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."debit_note_type" AS ENUM('local', 'server');--> statement-breakpoint
CREATE TYPE "public"."note_reason" AS ENUM('return', 'discount', 'pricing_error', 'damaged_goods', 'other');--> statement-breakpoint
CREATE TABLE "credit_note_client_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	CONSTRAINT "credit_note_client_details_credit_note_field_id_unique" UNIQUE("credit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "credit_note_client_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_client_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_company_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"logo" text,
	"signature" text,
	CONSTRAINT "credit_note_company_details_credit_note_field_id_unique" UNIQUE("credit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "credit_note_company_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_company_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_field_id" uuid NOT NULL,
	"theme" jsonb,
	"currency" text NOT NULL,
	"prefix" text DEFAULT 'CN-' NOT NULL,
	"serial_number" text NOT NULL,
	"date" timestamp NOT NULL,
	"original_invoice_number" text,
	CONSTRAINT "credit_note_details_credit_note_field_id_unique" UNIQUE("credit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "credit_note_details_billing_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "billing_detail_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
	CONSTRAINT "credit_note_fields_credit_note_id_unique" UNIQUE("credit_note_id")
);
--> statement-breakpoint
CREATE TABLE "credit_note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_field_id" uuid NOT NULL,
	"notes" text,
	"terms" text,
	CONSTRAINT "credit_note_metadata_credit_note_field_id_unique" UNIQUE("credit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid,
	"vendor_id" uuid,
	"type" "credit_note_type" DEFAULT 'server' NOT NULL,
	"status" "credit_note_status" DEFAULT 'draft' NOT NULL,
	"reason" "note_reason" NOT NULL,
	"reason_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "debit_note_client_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	CONSTRAINT "debit_note_client_details_debit_note_field_id_unique" UNIQUE("debit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "debit_note_client_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_client_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debit_note_company_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"logo" text,
	"signature" text,
	CONSTRAINT "debit_note_company_details_debit_note_field_id_unique" UNIQUE("debit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "debit_note_company_details_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_company_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debit_note_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_field_id" uuid NOT NULL,
	"theme" jsonb,
	"currency" text NOT NULL,
	"prefix" text DEFAULT 'DN-' NOT NULL,
	"serial_number" text NOT NULL,
	"date" timestamp NOT NULL,
	"original_invoice_number" text,
	CONSTRAINT "debit_note_details_debit_note_field_id_unique" UNIQUE("debit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "debit_note_details_billing_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_details_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "billing_detail_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debit_note_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" uuid NOT NULL,
	CONSTRAINT "debit_note_fields_debit_note_id_unique" UNIQUE("debit_note_id")
);
--> statement-breakpoint
CREATE TABLE "debit_note_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_field_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debit_note_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_field_id" uuid NOT NULL,
	"notes" text,
	"terms" text,
	CONSTRAINT "debit_note_metadata_debit_note_field_id_unique" UNIQUE("debit_note_field_id")
);
--> statement-breakpoint
CREATE TABLE "debit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_id" uuid,
	"customer_id" uuid,
	"vendor_id" uuid,
	"type" "debit_note_type" DEFAULT 'server' NOT NULL,
	"status" "debit_note_status" DEFAULT 'draft' NOT NULL,
	"reason" "note_reason" NOT NULL,
	"reason_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "credit_note_client_details" ADD CONSTRAINT "credit_note_client_details_credit_note_field_id_credit_note_fields_id_fk" FOREIGN KEY ("credit_note_field_id") REFERENCES "public"."credit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_client_details_metadata" ADD CONSTRAINT "credit_note_client_details_metadata_credit_note_client_details_id_credit_note_client_details_id_fk" FOREIGN KEY ("credit_note_client_details_id") REFERENCES "public"."credit_note_client_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_company_details" ADD CONSTRAINT "credit_note_company_details_credit_note_field_id_credit_note_fields_id_fk" FOREIGN KEY ("credit_note_field_id") REFERENCES "public"."credit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_company_details_metadata" ADD CONSTRAINT "credit_note_company_details_metadata_credit_note_company_details_id_credit_note_company_details_id_fk" FOREIGN KEY ("credit_note_company_details_id") REFERENCES "public"."credit_note_company_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_details" ADD CONSTRAINT "credit_note_details_credit_note_field_id_credit_note_fields_id_fk" FOREIGN KEY ("credit_note_field_id") REFERENCES "public"."credit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_details_billing_details" ADD CONSTRAINT "credit_note_details_billing_details_credit_note_details_id_credit_note_details_id_fk" FOREIGN KEY ("credit_note_details_id") REFERENCES "public"."credit_note_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_fields" ADD CONSTRAINT "credit_note_fields_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_credit_note_field_id_credit_note_fields_id_fk" FOREIGN KEY ("credit_note_field_id") REFERENCES "public"."credit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_metadata" ADD CONSTRAINT "credit_note_metadata_credit_note_field_id_credit_note_fields_id_fk" FOREIGN KEY ("credit_note_field_id") REFERENCES "public"."credit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_client_details" ADD CONSTRAINT "debit_note_client_details_debit_note_field_id_debit_note_fields_id_fk" FOREIGN KEY ("debit_note_field_id") REFERENCES "public"."debit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_client_details_metadata" ADD CONSTRAINT "debit_note_client_details_metadata_debit_note_client_details_id_debit_note_client_details_id_fk" FOREIGN KEY ("debit_note_client_details_id") REFERENCES "public"."debit_note_client_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_company_details" ADD CONSTRAINT "debit_note_company_details_debit_note_field_id_debit_note_fields_id_fk" FOREIGN KEY ("debit_note_field_id") REFERENCES "public"."debit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_company_details_metadata" ADD CONSTRAINT "debit_note_company_details_metadata_debit_note_company_details_id_debit_note_company_details_id_fk" FOREIGN KEY ("debit_note_company_details_id") REFERENCES "public"."debit_note_company_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_details" ADD CONSTRAINT "debit_note_details_debit_note_field_id_debit_note_fields_id_fk" FOREIGN KEY ("debit_note_field_id") REFERENCES "public"."debit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_details_billing_details" ADD CONSTRAINT "debit_note_details_billing_details_debit_note_details_id_debit_note_details_id_fk" FOREIGN KEY ("debit_note_details_id") REFERENCES "public"."debit_note_details"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_fields" ADD CONSTRAINT "debit_note_fields_debit_note_id_debit_notes_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debit_note_field_id_debit_note_fields_id_fk" FOREIGN KEY ("debit_note_field_id") REFERENCES "public"."debit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_metadata" ADD CONSTRAINT "debit_note_metadata_debit_note_field_id_debit_note_fields_id_fk" FOREIGN KEY ("debit_note_field_id") REFERENCES "public"."debit_note_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_notes_user_id_idx" ON "credit_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_id_idx" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "credit_notes_customer_id_idx" ON "credit_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "credit_notes_vendor_id_idx" ON "credit_notes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "credit_notes_status_idx" ON "credit_notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "debit_notes_user_id_idx" ON "debit_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debit_notes_invoice_id_idx" ON "debit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "debit_notes_customer_id_idx" ON "debit_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "debit_notes_vendor_id_idx" ON "debit_notes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "debit_notes_status_idx" ON "debit_notes" USING btree ("status");