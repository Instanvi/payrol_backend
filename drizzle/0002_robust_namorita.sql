CREATE TABLE "charges" (
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"invited_by_user_id" uuid,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"accepted_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "mobile_payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"wallet_id" uuid,
	"external_reference_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text NOT NULL,
	"party_id" text NOT NULL,
	"provider" text,
	"external_id" text,
	"payer_message" text,
	"payee_note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_status" text,
	"financial_transaction_id" text,
	"failure_reason" text,
	"pay_run_id" uuid,
	"payroll_transaction_id" uuid,
	"idempotency_key" text,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_payment_transactions_external_reference_id_unique" UNIQUE("external_reference_id")
);
--> statement-breakpoint
CREATE TABLE "project_employees" (
	"project_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	CONSTRAINT "project_employees_project_id_employee_id_pk" PRIMARY KEY("project_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_plans" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "momo_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "fee_plans" CASCADE;--> statement-breakpoint
DROP TABLE "momo_transactions" CASCADE;--> statement-breakpoint
ALTER TABLE "pay_runs" DROP CONSTRAINT "pay_runs_platform_fee_plan_id_fee_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "auth_challenges" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_challenges" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "company_kyc_documents" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_kyc_documents" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "company_review_events" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_review_events" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "members" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pay_runs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pay_runs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pay_runs" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pay_runs" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "payment_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_logs" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "payroll_transactions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "payroll_transactions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "currency" SET DEFAULT 'XAF';--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wallets" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "charge_id" uuid;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "platform_charge_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_logs" ADD COLUMN "mobile_payment_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" ADD CONSTRAINT "mobile_payment_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" ADD CONSTRAINT "mobile_payment_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" ADD CONSTRAINT "mobile_payment_transactions_pay_run_id_pay_runs_id_fk" FOREIGN KEY ("pay_run_id") REFERENCES "public"."pay_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" ADD CONSTRAINT "mobile_payment_transactions_payroll_transaction_id_payroll_transactions_id_fk" FOREIGN KEY ("payroll_transaction_id") REFERENCES "public"."payroll_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_employees" ADD CONSTRAINT "project_employees_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_employees" ADD CONSTRAINT "project_employees_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_company_code_unique" ON "projects" USING btree ("company_id","code");--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_platform_charge_id_charges_id_fk" FOREIGN KEY ("platform_charge_id") REFERENCES "public"."charges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_transactions" ADD CONSTRAINT "payroll_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "fee_plan_id";--> statement-breakpoint
ALTER TABLE "pay_runs" DROP COLUMN "platform_fee_plan_id";--> statement-breakpoint
ALTER TABLE "payment_logs" DROP COLUMN "momo_transaction_id";