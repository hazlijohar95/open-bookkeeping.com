CREATE INDEX "api_key_usage_key_created_idx" ON "api_key_usage" USING btree ("api_key_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_retry_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "webhooks_user_active_idx" ON "webhooks" USING btree ("user_id","is_active");