CREATE INDEX "invoice_details_due_date_idx" ON "invoice_details" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoice_details_invoice_field_id_idx" ON "invoice_details" USING btree ("invoice_field_id");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_field_id_idx" ON "invoice_items" USING btree ("invoice_field_id");