CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'cash', 'check', 'credit_card', 'debit_card', 'online', 'offset', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('invoice_payment', 'bill_payment');--> statement-breakpoint
ALTER TYPE "public"."source_document_type" ADD VALUE 'payment';--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid,
	"bill_id" uuid,
	"credit_note_id" uuid,
	"debit_note_id" uuid,
	"allocated_amount" numeric(15, 2) NOT NULL,
	"wht_allocated" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_number" varchar(30) NOT NULL,
	"payment_type" "payment_type" NOT NULL,
	"customer_id" uuid,
	"vendor_id" uuid,
	"payment_date" date NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"reference" varchar(100),
	"currency" varchar(3) DEFAULT 'MYR' NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"wht_amount" numeric(15, 2) DEFAULT '0',
	"wht_rate" numeric(5, 2),
	"bank_account_id" uuid,
	"bank_transaction_id" uuid,
	"journal_entry_id" uuid,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "payments_user_number_unique" UNIQUE("user_id","payment_number")
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_debit_note_id_debit_notes_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_bill_id_idx" ON "payment_allocations" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_credit_note_id_idx" ON "payment_allocations" USING btree ("credit_note_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_debit_note_id_idx" ON "payment_allocations" USING btree ("debit_note_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_customer_id_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_vendor_id_idx" ON "payments" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_payment_date_idx" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_payment_type_idx" ON "payments" USING btree ("payment_type");--> statement-breakpoint
CREATE INDEX "payments_journal_entry_idx" ON "payments" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "payments_user_type_date_idx" ON "payments" USING btree ("user_id","payment_type","payment_date");