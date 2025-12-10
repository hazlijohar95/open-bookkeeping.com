CREATE TYPE "public"."accounting_period_status" AS ENUM('open', 'closed', 'locked');--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"status" "accounting_period_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"closed_by" uuid,
	"reopened_at" timestamp,
	"reopened_by" uuid,
	"reopen_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_periods_user_period_unique" UNIQUE("user_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"journal_entry_line_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"entry_number" varchar(30) NOT NULL,
	"description" text,
	"reference" varchar(100),
	"source_type" "source_document_type",
	"source_id" uuid,
	"debit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"running_balance" numeric(15, 2) NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"normal_balance" "normal_balance" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD COLUMN "calculated_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_journal_entry_line_id_journal_entry_lines_id_fk" FOREIGN KEY ("journal_entry_line_id") REFERENCES "public"."journal_entry_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_periods_user_idx" ON "accounting_periods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounting_periods_year_idx" ON "accounting_periods" USING btree ("year");--> statement-breakpoint
CREATE INDEX "ledger_transactions_user_account_idx" ON "ledger_transactions" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_date_idx" ON "ledger_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "ledger_transactions_account_date_idx" ON "ledger_transactions" USING btree ("account_id","transaction_date");--> statement-breakpoint
CREATE INDEX "ledger_transactions_source_idx" ON "ledger_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_entry_idx" ON "ledger_transactions" USING btree ("journal_entry_id");