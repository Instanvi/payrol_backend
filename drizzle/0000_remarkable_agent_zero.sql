CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"purpose" text DEFAULT 'login' NOT NULL,
	"otp_code_hash" text NOT NULL,
	"otp_attempts" integer DEFAULT 0 NOT NULL,
	"max_otp_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" text NOT NULL,
	"last_sent_at" text NOT NULL,
	"notification_id" uuid,
	"created_at" text NOT NULL,
	CONSTRAINT "auth_challenges_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"plan" text DEFAULT 'starter' NOT NULL,
	"industry" text,
	"timezone" text DEFAULT 'America/New_York',
	"address" text,
	"tax_id" text,
	"billing_email" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"onboarding_step" text DEFAULT 'profile' NOT NULL,
	"rejection_reason" text,
	"approved_at" text,
	"approved_by_user_id" uuid,
	"fee_plan_id" uuid,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_url" text,
	"uploaded_by_user_id" uuid,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"metadata" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"department" text,
	"job_title" text,
	"employment_type" text DEFAULT 'full_time' NOT NULL,
	"start_date" text,
	"base_salary" real,
	"tax_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"mobile_carrier" text,
	"mobile_account_valid" boolean,
	"mobile_account_validated_at" text,
	"mobile_account_validation_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"fixed_fee" real DEFAULT 0 NOT NULL,
	"percent_fee" real DEFAULT 0 NOT NULL,
	"min_fee" real,
	"max_fee" real,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_body" text,
	"status_code" integer,
	"status" text DEFAULT 'processing' NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "momo_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"wallet_id" uuid,
	"external_reference_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text NOT NULL,
	"party_id" text NOT NULL,
	"external_id" text,
	"payer_message" text,
	"payee_note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"momo_status" text,
	"financial_transaction_id" text,
	"failure_reason" text,
	"pay_run_id" uuid,
	"payroll_transaction_id" uuid,
	"idempotency_key" text,
	"job_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "momo_transactions_external_reference_id_unique" UNIQUE("external_reference_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"company_id" uuid,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"template_key" text,
	"body_preview" text,
	"metadata" text,
	"provider" text DEFAULT 'resend' NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" text,
	"read_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_run_employees" (
	"pay_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	CONSTRAINT "pay_run_employees_pay_run_id_employee_id_pk" PRIMARY KEY("pay_run_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "pay_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"pay_period" text NOT NULL,
	"description" text,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" text,
	"processed_at" text,
	"created_by" uuid,
	"platform_fee_amount" real DEFAULT 0 NOT NULL,
	"platform_fee_plan_id" uuid,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"level" text NOT NULL,
	"event" text NOT NULL,
	"message" text NOT NULL,
	"metadata" text,
	"momo_transaction_id" uuid,
	"job_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"pay_run_reference" text NOT NULL,
	"pay_period" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_name" text NOT NULL,
	"employee_email" text NOT NULL,
	"gross_amount" real NOT NULL,
	"deductions" real DEFAULT 0 NOT NULL,
	"amount" real NOT NULL,
	"currency" text NOT NULL,
	"employee_phone" text,
	"reference" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"paid_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"avatar" text,
	"phone" text,
	"role" text NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"last_login_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"balance" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"momo_account_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_kyc_documents" ADD CONSTRAINT "company_kyc_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_review_events" ADD CONSTRAINT "company_review_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momo_transactions" ADD CONSTRAINT "momo_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momo_transactions" ADD CONSTRAINT "momo_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momo_transactions" ADD CONSTRAINT "momo_transactions_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "momo_transactions" ADD CONSTRAINT "momo_transactions_payroll_transaction_id_payroll_transactions_id_fk" FOREIGN KEY ("payroll_transaction_id") REFERENCES "public"."payroll_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_employees" ADD CONSTRAINT "pay_run_employees_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_employees" ADD CONSTRAINT "pay_run_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_platform_fee_plan_id_fee_plans_id_fk" FOREIGN KEY ("platform_fee_plan_id") REFERENCES "public"."fee_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ADD CONSTRAINT "payroll_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ADD CONSTRAINT "payroll_transactions_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ADD CONSTRAINT "payroll_transactions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_company_key" ON "idempotency_keys" USING btree ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_company_id_unique" ON "wallets" USING btree ("company_id");