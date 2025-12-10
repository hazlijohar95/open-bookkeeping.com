CREATE TABLE "invoice_monthly_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"total_revenue" numeric(15, 2) DEFAULT '0' NOT NULL,
	"invoice_count" integer DEFAULT 0 NOT NULL,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"pending_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"overdue_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_monthly_totals_user_period_unique" UNIQUE("user_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "sst_monthly_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"sales_tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"service_tax_total" numeric(15, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sst_monthly_totals_user_period_unique" UNIQUE("user_id","period")
);
--> statement-breakpoint
ALTER TABLE "invoice_monthly_totals" ADD CONSTRAINT "invoice_monthly_totals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sst_monthly_totals" ADD CONSTRAINT "sst_monthly_totals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_monthly_totals_user_idx" ON "invoice_monthly_totals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoice_monthly_totals_period_idx" ON "invoice_monthly_totals" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "sst_monthly_totals_user_idx" ON "sst_monthly_totals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invoices_user_customer_created_idx" ON "invoices" USING btree ("user_id","customer_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_user_paid_idx" ON "invoices" USING btree ("user_id","paid_at");--> statement-breakpoint
CREATE INDEX "bank_transactions_user_match_idx" ON "bank_transactions" USING btree ("user_id","match_status");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_account_created_idx" ON "journal_entry_lines" USING btree ("account_id","created_at");