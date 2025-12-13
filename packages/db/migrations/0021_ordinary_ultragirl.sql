CREATE TYPE "public"."calculation_method" AS ENUM('fixed', 'percentage', 'hourly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('active', 'probation', 'terminated', 'resigned', 'retired');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'intern');--> statement-breakpoint
CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed');--> statement-breakpoint
CREATE TYPE "public"."nationality_type" AS ENUM('malaysian', 'permanent_resident', 'foreign');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('monthly', 'bi_weekly', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."pay_slip_status" AS ENUM('draft', 'calculated', 'approved', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'calculating', 'pending_review', 'approved', 'finalized', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."salary_component_type" AS ENUM('earnings', 'deductions');--> statement-breakpoint
CREATE TYPE "public"."statutory_contribution_type" AS ENUM('epf_employer', 'epf_employee', 'socso_employer', 'socso_employee', 'eis_employer', 'eis_employee');--> statement-breakpoint
CREATE TYPE "public"."import_type" AS ENUM('chart_of_accounts', 'opening_balances', 'customers', 'vendors', 'open_invoices', 'open_bills', 'bank_transactions', 'employees', 'payroll_ytd');--> statement-breakpoint
CREATE TYPE "public"."migration_session_status" AS ENUM('draft', 'in_progress', 'validating', 'validated', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_system" AS ENUM('quickbooks', 'xero', 'sage', 'wave', 'zoho', 'sql_accounting', 'autocount', 'custom');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('pending', 'valid', 'warning', 'error');--> statement-breakpoint
ALTER TYPE "public"."source_document_type" ADD VALUE 'payroll';--> statement-breakpoint
CREATE TABLE "employee_salaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"base_salary" numeric(15, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'MYR' NOT NULL,
	"pay_frequency" "pay_frequency" DEFAULT 'monthly' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"employee_code" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"ic_number" varchar(20),
	"passport_number" varchar(30),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"nationality" "nationality_type" DEFAULT 'malaysian' NOT NULL,
	"date_of_birth" date,
	"date_joined" date NOT NULL,
	"date_resigned" date,
	"probation_end_date" date,
	"department" varchar(100),
	"position" varchar(100),
	"bank_name" varchar(100),
	"bank_account_number" varchar(30),
	"bank_account_holder" varchar(100),
	"tax_number" varchar(20),
	"marital_status" "marital_status" DEFAULT 'single',
	"spouse_working" boolean DEFAULT true,
	"number_of_children" integer DEFAULT 0,
	"children_in_university" integer DEFAULT 0,
	"disabled_children" integer DEFAULT 0,
	"epf_number" varchar(20),
	"socso_number" varchar(20),
	"eis_number" varchar(20),
	"epf_employee_rate" numeric(5, 2),
	"epf_employer_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "employees_user_code_unique" UNIQUE("user_id","employee_code")
);
--> statement-breakpoint
CREATE TABLE "pay_slip_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pay_slip_id" uuid NOT NULL,
	"salary_component_id" uuid,
	"component_code" varchar(20) NOT NULL,
	"component_name" varchar(100) NOT NULL,
	"component_type" "salary_component_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"calculation_details" jsonb,
	"is_epf_applicable" boolean DEFAULT true NOT NULL,
	"is_socso_applicable" boolean DEFAULT true NOT NULL,
	"is_eis_applicable" boolean DEFAULT true NOT NULL,
	"is_pcb_applicable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"slip_number" varchar(30) NOT NULL,
	"employee_code" varchar(20) NOT NULL,
	"employee_name" varchar(200) NOT NULL,
	"department" varchar(100),
	"position" varchar(100),
	"ic_number" varchar(20),
	"bank_name" varchar(100),
	"bank_account_number" varchar(30),
	"base_salary" numeric(15, 2) NOT NULL,
	"working_days" integer DEFAULT 0,
	"days_worked" integer DEFAULT 0,
	"total_earnings" numeric(15, 2) DEFAULT '0' NOT NULL,
	"gross_salary" numeric(15, 2) NOT NULL,
	"epf_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"epf_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"epf_wage" numeric(15, 2) DEFAULT '0',
	"socso_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"socso_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"socso_wage" numeric(15, 2) DEFAULT '0',
	"eis_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"eis_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"eis_wage" numeric(15, 2) DEFAULT '0',
	"pcb" numeric(15, 2) DEFAULT '0' NOT NULL,
	"pcb_wage" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0' NOT NULL,
	"net_salary" numeric(15, 2) NOT NULL,
	"ytd_gross_salary" numeric(15, 2) DEFAULT '0',
	"ytd_epf_employee" numeric(15, 2) DEFAULT '0',
	"ytd_pcb" numeric(15, 2) DEFAULT '0',
	"status" "pay_slip_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pay_slips_run_employee_unique" UNIQUE("payroll_run_id","employee_id"),
	CONSTRAINT "pay_slips_number_unique" UNIQUE("slip_number")
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"run_number" varchar(30) NOT NULL,
	"name" varchar(100),
	"period_year" integer NOT NULL,
	"period_month" integer NOT NULL,
	"pay_date" date NOT NULL,
	"period_start_date" date NOT NULL,
	"period_end_date" date NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"total_employees" integer DEFAULT 0,
	"total_gross_salary" numeric(15, 2) DEFAULT '0',
	"total_deductions" numeric(15, 2) DEFAULT '0',
	"total_net_salary" numeric(15, 2) DEFAULT '0',
	"total_epf_employer" numeric(15, 2) DEFAULT '0',
	"total_epf_employee" numeric(15, 2) DEFAULT '0',
	"total_socso_employer" numeric(15, 2) DEFAULT '0',
	"total_socso_employee" numeric(15, 2) DEFAULT '0',
	"total_eis_employer" numeric(15, 2) DEFAULT '0',
	"total_eis_employee" numeric(15, 2) DEFAULT '0',
	"total_pcb" numeric(15, 2) DEFAULT '0',
	"journal_entry_id" uuid,
	"calculated_at" timestamp,
	"calculated_by" uuid,
	"approved_at" timestamp,
	"approved_by" uuid,
	"finalized_at" timestamp,
	"finalized_by" uuid,
	"paid_at" timestamp,
	"paid_by" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "payroll_runs_user_number_unique" UNIQUE("user_id","run_number"),
	CONSTRAINT "payroll_runs_user_period_unique" UNIQUE("user_id","period_year","period_month")
);
--> statement-breakpoint
CREATE TABLE "salary_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"component_type" "salary_component_type" NOT NULL,
	"calculation_method" "calculation_method" DEFAULT 'fixed' NOT NULL,
	"default_amount" numeric(15, 2),
	"default_percentage" numeric(5, 2),
	"is_epf_applicable" boolean DEFAULT true NOT NULL,
	"is_socso_applicable" boolean DEFAULT true NOT NULL,
	"is_eis_applicable" boolean DEFAULT true NOT NULL,
	"is_pcb_applicable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "salary_components_user_code_unique" UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "statutory_contribution_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_type" "statutory_contribution_type" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"wage_from" numeric(15, 2) NOT NULL,
	"wage_to" numeric(15, 2) NOT NULL,
	"contribution_amount" numeric(15, 2),
	"contribution_rate" numeric(5, 4),
	"conditions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_mapping_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"source_code" text NOT NULL,
	"source_name" text NOT NULL,
	"source_type" text,
	"target_account_id" uuid,
	"target_account_code" text,
	"target_account_name" text,
	"confidence" numeric(5, 2) NOT NULL,
	"reasoning" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_selected_account_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"options" jsonb NOT NULL,
	"generated_counts" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_session_id" uuid,
	"user_id" text NOT NULL,
	"import_type" "import_type" NOT NULL,
	"template_id" uuid,
	"file_name" text,
	"file_size" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0,
	"processed_rows" integer DEFAULT 0,
	"success_rows" integer DEFAULT 0,
	"error_rows" integer DEFAULT 0,
	"errors" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"import_type" "import_type" NOT NULL,
	"source_system" "source_system",
	"column_mapping" jsonb NOT NULL,
	"has_header_row" boolean DEFAULT true,
	"delimiter" text DEFAULT ',',
	"date_format" text DEFAULT 'DD/MM/YYYY',
	"decimal_separator" text DEFAULT '.',
	"usage_count" integer DEFAULT 0,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Data Migration',
	"status" "migration_session_status" DEFAULT 'draft' NOT NULL,
	"source_system" "source_system",
	"conversion_date" date,
	"financial_year_start" date,
	"current_step" text,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"total_steps" integer DEFAULT 7,
	"validation_status" "validation_status" DEFAULT 'pending',
	"validation_results" jsonb,
	"total_debits" numeric(15, 2) DEFAULT '0',
	"total_credits" numeric(15, 2) DEFAULT '0',
	"is_balanced" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "opening_balance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid,
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" text NOT NULL,
	"debit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"credit_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"has_subledger_detail" boolean DEFAULT false,
	"validation_status" "validation_status" DEFAULT 'pending',
	"validation_errors" jsonb,
	"is_auto_mapped" boolean DEFAULT false,
	"mapping_confidence" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening_balance_subledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opening_balance_entry_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"entity_name" text NOT NULL,
	"reference_number" text NOT NULL,
	"document_date" date,
	"due_date" date,
	"original_amount" numeric(15, 2) NOT NULL,
	"outstanding_amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_ytd_migration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_session_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"as_of_date" date NOT NULL,
	"months_worked" integer DEFAULT 0 NOT NULL,
	"ytd_gross_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_base_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_allowances" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_other_earnings" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_total_deductions" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_other_deductions" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_epf_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_socso_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_eis_employee" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_pcb" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_epf_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_socso_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_eis_employer" numeric(15, 2) DEFAULT '0' NOT NULL,
	"ytd_net_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
	"validation_status" "validation_status" DEFAULT 'pending',
	"validation_errors" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_slip_items" ADD CONSTRAINT "pay_slip_items_pay_slip_id_pay_slips_id_fk" FOREIGN KEY ("pay_slip_id") REFERENCES "public"."pay_slips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_slip_items" ADD CONSTRAINT "pay_slip_items_salary_component_id_salary_components_id_fk" FOREIGN KEY ("salary_component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_slips" ADD CONSTRAINT "pay_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_finalized_by_users_id_fk" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mapping_suggestions" ADD CONSTRAINT "account_mapping_suggestions_migration_session_id_migration_sessions_id_fk" FOREIGN KEY ("migration_session_id") REFERENCES "public"."migration_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mapping_suggestions" ADD CONSTRAINT "account_mapping_suggestions_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mapping_suggestions" ADD CONSTRAINT "account_mapping_suggestions_user_selected_account_id_accounts_id_fk" FOREIGN KEY ("user_selected_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_migration_session_id_migration_sessions_id_fk" FOREIGN KEY ("migration_session_id") REFERENCES "public"."migration_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_template_id_import_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."import_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balance_entries" ADD CONSTRAINT "opening_balance_entries_migration_session_id_migration_sessions_id_fk" FOREIGN KEY ("migration_session_id") REFERENCES "public"."migration_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balance_entries" ADD CONSTRAINT "opening_balance_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balance_subledger" ADD CONSTRAINT "opening_balance_subledger_opening_balance_entry_id_opening_balance_entries_id_fk" FOREIGN KEY ("opening_balance_entry_id") REFERENCES "public"."opening_balance_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_ytd_migration" ADD CONSTRAINT "payroll_ytd_migration_migration_session_id_migration_sessions_id_fk" FOREIGN KEY ("migration_session_id") REFERENCES "public"."migration_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_ytd_migration" ADD CONSTRAINT "payroll_ytd_migration_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_salaries_employee_id_idx" ON "employee_salaries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_salaries_effective_from_idx" ON "employee_salaries" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "employee_salaries_employee_effective_idx" ON "employee_salaries" USING btree ("employee_id","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "employees_user_id_idx" ON "employees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "employees_department_idx" ON "employees" USING btree ("department");--> statement-breakpoint
CREATE INDEX "employees_user_deleted_idx" ON "employees" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "employees_ic_number_idx" ON "employees" USING btree ("ic_number");--> statement-breakpoint
CREATE INDEX "pay_slip_items_pay_slip_id_idx" ON "pay_slip_items" USING btree ("pay_slip_id");--> statement-breakpoint
CREATE INDEX "pay_slip_items_component_id_idx" ON "pay_slip_items" USING btree ("salary_component_id");--> statement-breakpoint
CREATE INDEX "pay_slips_payroll_run_id_idx" ON "pay_slips" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "pay_slips_employee_id_idx" ON "pay_slips" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "pay_slips_status_idx" ON "pay_slips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payroll_runs_user_id_idx" ON "payroll_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payroll_runs_period_idx" ON "payroll_runs" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX "salary_components_user_id_idx" ON "salary_components" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "salary_components_type_idx" ON "salary_components" USING btree ("component_type");--> statement-breakpoint
CREATE INDEX "statutory_tables_type_idx" ON "statutory_contribution_tables" USING btree ("contribution_type");--> statement-breakpoint
CREATE INDEX "statutory_tables_effective_idx" ON "statutory_contribution_tables" USING btree ("effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "statutory_tables_wage_idx" ON "statutory_contribution_tables" USING btree ("wage_from","wage_to");--> statement-breakpoint
CREATE INDEX "account_mapping_suggestions_session_idx" ON "account_mapping_suggestions" USING btree ("migration_session_id");--> statement-breakpoint
CREATE INDEX "account_mapping_suggestions_status_idx" ON "account_mapping_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "demo_data_requests_user_idx" ON "demo_data_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_jobs_session_idx" ON "import_jobs" USING btree ("migration_session_id");--> statement-breakpoint
CREATE INDEX "import_jobs_user_idx" ON "import_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_templates_user_idx" ON "import_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_templates_type_idx" ON "import_templates" USING btree ("import_type");--> statement-breakpoint
CREATE UNIQUE INDEX "import_templates_user_name_idx" ON "import_templates" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "migration_sessions_user_id_idx" ON "migration_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "migration_sessions_status_idx" ON "migration_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opening_balance_entries_session_idx" ON "opening_balance_entries" USING btree ("migration_session_id");--> statement-breakpoint
CREATE INDEX "opening_balance_entries_user_idx" ON "opening_balance_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "opening_balance_entries_account_idx" ON "opening_balance_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "opening_balance_subledger_entry_idx" ON "opening_balance_subledger" USING btree ("opening_balance_entry_id");--> statement-breakpoint
CREATE INDEX "opening_balance_subledger_entity_idx" ON "opening_balance_subledger" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "payroll_ytd_migration_session_idx" ON "payroll_ytd_migration" USING btree ("migration_session_id");--> statement-breakpoint
CREATE INDEX "payroll_ytd_migration_employee_idx" ON "payroll_ytd_migration" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_ytd_migration_unique_idx" ON "payroll_ytd_migration" USING btree ("migration_session_id","employee_id");