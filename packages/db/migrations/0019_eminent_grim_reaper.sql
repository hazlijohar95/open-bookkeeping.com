CREATE TYPE "public"."agent_action_type" AS ENUM('create_invoice', 'update_invoice', 'send_invoice', 'mark_invoice_paid', 'void_invoice', 'create_bill', 'update_bill', 'mark_bill_paid', 'schedule_bill_payment', 'create_journal_entry', 'reverse_journal_entry', 'create_quotation', 'update_quotation', 'send_quotation', 'convert_quotation', 'create_customer', 'update_customer', 'create_vendor', 'update_vendor', 'match_transaction', 'create_matching_entry', 'read_data', 'analyze_data');--> statement-breakpoint
CREATE TYPE "public"."agent_approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'auto_approved');--> statement-breakpoint
CREATE TYPE "public"."agent_approval_type" AS ENUM('auto', 'manual', 'threshold');--> statement-breakpoint
CREATE TYPE "public"."agent_session_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."agent_workflow_status" AS ENUM('pending', 'running', 'paused', 'awaiting_approval', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."agent_workflow_step_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"action_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255),
	"status" "agent_session_status" DEFAULT 'active' NOT NULL,
	"initial_prompt" text,
	"system_context" jsonb,
	"summary" text,
	"total_prompt_tokens" integer DEFAULT 0 NOT NULL,
	"total_completion_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"workflow_id" uuid,
	"action" "agent_action_type" NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"previous_state" jsonb,
	"new_state" jsonb,
	"reasoning" text,
	"confidence" numeric(3, 2),
	"approved_by" uuid,
	"approval_type" "agent_approval_type",
	"approval_id" uuid,
	"is_reversible" varchar(10) DEFAULT 'yes',
	"reversed_at" timestamp,
	"reversed_by" uuid,
	"reversal_audit_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"success" varchar(10) DEFAULT 'yes' NOT NULL,
	"error_message" text,
	"error_details" jsonb,
	"financial_impact" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_approval_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"require_approval" boolean DEFAULT false NOT NULL,
	"invoice_threshold" numeric(15, 2),
	"bill_threshold" numeric(15, 2),
	"journal_entry_threshold" numeric(15, 2),
	"auto_approve_read_only" boolean DEFAULT true NOT NULL,
	"auto_approve_recurring" boolean DEFAULT false NOT NULL,
	"allowed_actions" jsonb,
	"blocked_actions" jsonb,
	"notify_on_approval_required" boolean DEFAULT true NOT NULL,
	"notify_on_auto_approved" boolean DEFAULT false NOT NULL,
	"approval_timeout_hours" numeric DEFAULT '24',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_approval_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_pending_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" "agent_action_type" NOT NULL,
	"action_payload" jsonb NOT NULL,
	"session_id" uuid,
	"reasoning" text,
	"confidence" numeric(3, 2),
	"status" "agent_approval_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"estimated_impact" jsonb,
	"preview_data" jsonb,
	"expires_at" timestamp NOT NULL,
	"result_audit_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_invoice_limit" integer DEFAULT 100 NOT NULL,
	"daily_bill_limit" integer DEFAULT 100 NOT NULL,
	"daily_journal_entry_limit" integer DEFAULT 200 NOT NULL,
	"daily_quotation_limit" integer DEFAULT 100 NOT NULL,
	"daily_token_limit" integer DEFAULT 1000000 NOT NULL,
	"max_single_invoice_amount" numeric(15, 2),
	"max_single_bill_amount" numeric(15, 2),
	"max_single_journal_amount" numeric(15, 2),
	"max_daily_total_amount" numeric(15, 2),
	"max_actions_per_minute" integer DEFAULT 30 NOT NULL,
	"max_concurrent_workflows" integer DEFAULT 5 NOT NULL,
	"emergency_stop_enabled" boolean DEFAULT false NOT NULL,
	"emergency_stop_reason" timestamp,
	"emergency_stopped_at" timestamp,
	"emergency_stopped_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_quotas_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "agent_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"invoices_created" integer DEFAULT 0 NOT NULL,
	"bills_created" integer DEFAULT 0 NOT NULL,
	"journal_entries_created" integer DEFAULT 0 NOT NULL,
	"quotations_created" integer DEFAULT 0 NOT NULL,
	"total_actions" integer DEFAULT 0 NOT NULL,
	"total_mutations" integer DEFAULT 0 NOT NULL,
	"total_reads" integer DEFAULT 0 NOT NULL,
	"total_amount_processed" numeric(15, 2) DEFAULT '0',
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"prompt_tokens_used" integer DEFAULT 0 NOT NULL,
	"completion_tokens_used" integer DEFAULT 0 NOT NULL,
	"workflows_started" integer DEFAULT 0 NOT NULL,
	"workflows_completed" integer DEFAULT 0 NOT NULL,
	"workflows_failed" integer DEFAULT 0 NOT NULL,
	"approvals_requested" integer DEFAULT 0 NOT NULL,
	"approvals_granted" integer DEFAULT 0 NOT NULL,
	"approvals_rejected" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"action" "agent_action_type" NOT NULL,
	"description" text,
	"parameters" jsonb,
	"depends_on" jsonb,
	"status" "agent_workflow_step_status" DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"requires_approval" varchar(10) DEFAULT 'no',
	"approval_id" uuid,
	"audit_log_id" uuid,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_workflow_templates" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50),
	"steps" jsonb NOT NULL,
	"estimated_duration" varchar(50),
	"is_enabled" varchar(10) DEFAULT 'yes',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"template_id" varchar(100),
	"total_steps" integer NOT NULL,
	"completed_steps" integer DEFAULT 0 NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" "agent_workflow_status" DEFAULT 'pending' NOT NULL,
	"plan" jsonb,
	"execution_log" jsonb,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"workflow_context" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"paused_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_approval_settings" ADD CONSTRAINT "agent_approval_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_approvals" ADD CONSTRAINT "agent_pending_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_approvals" ADD CONSTRAINT "agent_pending_approvals_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_approvals" ADD CONSTRAINT "agent_pending_approvals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quotas" ADD CONSTRAINT "agent_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_quotas" ADD CONSTRAINT "agent_quotas_emergency_stopped_by_users_id_fk" FOREIGN KEY ("emergency_stopped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_usage" ADD CONSTRAINT "agent_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflow_steps" ADD CONSTRAINT "agent_workflow_steps_workflow_id_agent_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."agent_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_workflows" ADD CONSTRAINT "agent_workflows_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_messages_session_id_idx" ON "agent_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_messages_session_created_idx" ON "agent_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_id_idx" ON "agent_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_created_idx" ON "agent_sessions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_audit_user_id_idx" ON "agent_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_audit_session_idx" ON "agent_audit_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_audit_workflow_idx" ON "agent_audit_logs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "agent_audit_resource_idx" ON "agent_audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "agent_audit_action_idx" ON "agent_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "agent_audit_created_idx" ON "agent_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_audit_user_created_idx" ON "agent_audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_audit_user_action_idx" ON "agent_audit_logs" USING btree ("user_id","action");--> statement-breakpoint
CREATE INDEX "agent_pending_user_idx" ON "agent_pending_approvals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_pending_status_idx" ON "agent_pending_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_pending_user_status_idx" ON "agent_pending_approvals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "agent_pending_expires_idx" ON "agent_pending_approvals" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "agent_pending_session_idx" ON "agent_pending_approvals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_usage_user_date_idx" ON "agent_usage" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "agent_usage_user_idx" ON "agent_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_usage_date_idx" ON "agent_usage" USING btree ("date");--> statement-breakpoint
CREATE INDEX "agent_workflow_steps_workflow_idx" ON "agent_workflow_steps" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "agent_workflow_steps_status_idx" ON "agent_workflow_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_workflow_steps_workflow_step_idx" ON "agent_workflow_steps" USING btree ("workflow_id","step_number");--> statement-breakpoint
CREATE INDEX "agent_workflows_user_idx" ON "agent_workflows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_workflows_session_idx" ON "agent_workflows" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_workflows_status_idx" ON "agent_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_workflows_user_status_idx" ON "agent_workflows" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "agent_workflows_template_idx" ON "agent_workflows" USING btree ("template_id");