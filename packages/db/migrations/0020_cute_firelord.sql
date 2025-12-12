CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"embedding" jsonb,
	"tags" jsonb,
	"source_type" varchar(50) NOT NULL,
	"source_session_id" uuid,
	"source_message_id" uuid,
	"confidence" numeric(3, 2) DEFAULT '1.00',
	"use_count" numeric(10, 0) DEFAULT '0',
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_user_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_name" varchar(255),
	"company_address" text,
	"default_currency" varchar(3) DEFAULT 'MYR',
	"fiscal_year_end" varchar(10),
	"industry" varchar(100),
	"preferred_language" varchar(10) DEFAULT 'en',
	"date_format" varchar(20) DEFAULT 'YYYY-MM-DD',
	"invoice_prefix" varchar(20),
	"quotation_prefix" varchar(20),
	"verbosity_level" varchar(20) DEFAULT 'normal',
	"auto_suggest_actions" boolean DEFAULT true,
	"confirm_before_actions" boolean DEFAULT true,
	"common_tasks" jsonb,
	"frequent_customers" jsonb,
	"frequent_vendors" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_user_context_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_user_context" ADD CONSTRAINT "agent_user_context_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_memories_user_id_idx" ON "agent_memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_memories_category_idx" ON "agent_memories" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "agent_memories_key_idx" ON "agent_memories" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "agent_memories_active_idx" ON "agent_memories" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "agent_user_context_user_id_idx" ON "agent_user_context" USING btree ("user_id");