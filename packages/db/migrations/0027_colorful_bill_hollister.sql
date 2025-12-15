CREATE TYPE "public"."user_action_type" AS ENUM('login', 'logout', 'password_change', 'password_reset', 'session_refresh', 'mfa_enabled', 'mfa_disabled', 'settings_view', 'settings_update', 'profile_update', 'company_update', 'notification_update', 'agent_settings_update', 'export_invoices', 'export_customers', 'export_vendors', 'export_bills', 'export_reports', 'export_audit_logs', 'api_key_created', 'api_key_revoked', 'api_key_viewed', 'webhook_created', 'webhook_updated', 'webhook_deleted', 'bulk_delete', 'data_import', 'account_deletion_request', 'suspicious_activity', 'rate_limit_exceeded', 'invalid_access_attempt');--> statement-breakpoint
CREATE TABLE "user_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" "user_action_type" NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"resource_type" varchar(50),
	"resource_id" varchar(100),
	"previous_state" jsonb,
	"new_state" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(100),
	"geo_location" jsonb,
	"session_id" varchar(100),
	"device_info" jsonb,
	"success" varchar(10) DEFAULT 'yes' NOT NULL,
	"error_message" text,
	"error_code" varchar(50),
	"risk_level" varchar(20) DEFAULT 'low',
	"risk_factors" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_quotas" ALTER COLUMN "emergency_stop_reason" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_number" varchar(50);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "transaction_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "exchange_rate" numeric(15, 6);--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD COLUMN "foreign_debit_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD COLUMN "foreign_credit_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD COLUMN "line_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD COLUMN "line_exchange_rate" numeric(15, 6);--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "foreign_debit_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "foreign_credit_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "transaction_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD COLUMN "exchange_rate" numeric(15, 6);--> statement-breakpoint
ALTER TABLE "user_audit_logs" ADD CONSTRAINT "user_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_audit_user_id_idx" ON "user_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_audit_action_idx" ON "user_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_audit_category_idx" ON "user_audit_logs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "user_audit_created_idx" ON "user_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_audit_user_created_idx" ON "user_audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_audit_user_action_idx" ON "user_audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "user_audit_user_category_idx" ON "user_audit_logs" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "user_audit_ip_idx" ON "user_audit_logs" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "user_audit_risk_idx" ON "user_audit_logs" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "user_audit_session_idx" ON "user_audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_reconcile_idx" ON "bank_transactions" USING btree ("user_id","transaction_date","match_status");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_invoice_number_unique" UNIQUE("user_id","invoice_number");--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_unique_txn" UNIQUE("bank_account_id","transaction_date","amount","description");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_balanced" CHECK ("journal_entries"."total_debit" = "journal_entries"."total_credit");