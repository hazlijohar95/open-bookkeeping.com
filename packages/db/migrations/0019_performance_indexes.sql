-- Performance Indexes Migration
-- Adds indexes to improve query performance for common access patterns

-- Bank transactions: Filter by user and reconciliation status
CREATE INDEX IF NOT EXISTS "bank_transactions_user_reconciled_idx"
  ON "bank_transactions" ("user_id", "is_reconciled");

-- Bank transactions: Filter by user and date for date range queries
CREATE INDEX IF NOT EXISTS "bank_transactions_user_date_idx"
  ON "bank_transactions" ("user_id", "transaction_date" DESC);

-- Journal entry lines: Filter by account and date for ledger reports
CREATE INDEX IF NOT EXISTS "journal_entry_lines_account_created_idx"
  ON "journal_entry_lines" ("account_id", "created_at" DESC);

-- Invoices: Filter by user and paid date for revenue reports
CREATE INDEX IF NOT EXISTS "invoices_user_paid_at_idx"
  ON "invoices" ("user_id", "paid_at" DESC)
  WHERE "paid_at" IS NOT NULL;

-- Ledger transactions: Filter by user and period for financial reports
CREATE INDEX IF NOT EXISTS "ledger_transactions_user_period_idx"
  ON "ledger_transactions" ("user_id", "transaction_date" DESC);

-- Vault documents: Filter by user and category
CREATE INDEX IF NOT EXISTS "vault_documents_user_category_idx"
  ON "vault_documents" ("user_id", "category");

-- Webhook deliveries: Filter by webhook and status for retry logic
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_status_idx"
  ON "webhook_deliveries" ("webhook_id", "status");
