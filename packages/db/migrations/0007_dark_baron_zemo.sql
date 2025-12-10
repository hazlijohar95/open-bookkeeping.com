ALTER TABLE "invoice_details_billing_details" ALTER COLUMN "value" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "invoice_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotation_details_billing_details" ALTER COLUMN "value" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "quotation_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "credit_note_details_billing_details" ALTER COLUMN "value" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "credit_note_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "debit_note_details_billing_details" ALTER COLUMN "value" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "debit_note_items" ALTER COLUMN "unit_price" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
CREATE INDEX "invoices_user_status_idx" ON "invoices" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "invoices_user_created_idx" ON "invoices" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_user_deleted_idx" ON "invoices" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "quotations_user_status_idx" ON "quotations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "quotations_user_created_idx" ON "quotations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "quotations_user_deleted_idx" ON "quotations" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "credit_notes_user_status_idx" ON "credit_notes" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "credit_notes_user_created_idx" ON "credit_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_notes_user_deleted_idx" ON "credit_notes" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "debit_notes_user_status_idx" ON "debit_notes" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "debit_notes_user_created_idx" ON "debit_notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "debit_notes_user_deleted_idx" ON "debit_notes" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "bills_user_status_idx" ON "bills" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "bills_user_created_idx" ON "bills" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bills_user_deleted_idx" ON "bills" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "bills_user_due_date_idx" ON "bills" USING btree ("user_id","due_date");