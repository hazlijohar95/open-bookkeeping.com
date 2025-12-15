CREATE TABLE "agent_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"name" varchar(255) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_ms" integer,
	"status" varchar(20) DEFAULT 'unset' NOT NULL,
	"spans" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_traces" ADD CONSTRAINT "agent_traces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_traces" ADD CONSTRAINT "agent_traces_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_traces_user_id_idx" ON "agent_traces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_traces_session_idx" ON "agent_traces" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_traces_status_idx" ON "agent_traces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_traces_start_time_idx" ON "agent_traces" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "agent_traces_user_start_idx" ON "agent_traces" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_status_created_idx" ON "agent_sessions" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "agent_memories_active_expires_idx" ON "agent_memories" USING btree ("user_id","is_active","expires_at");--> statement-breakpoint
CREATE INDEX "agent_memories_last_used_idx" ON "agent_memories" USING btree ("user_id","last_used_at");