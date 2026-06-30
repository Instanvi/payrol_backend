import {
  pgTable,
  text,
  real,
  integer,
  boolean,
  uuid,
  uniqueIndex,
  primaryKey,
  timestamp,
} from "drizzle-orm/pg-core"

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  plan: text("plan").notNull().default("starter"),
  industry: text("industry"),
  timezone: text("timezone").default("America/New_York"),
  address: text("address"),
  taxId: text("tax_id"),
  billingEmail: text("billing_email"),
  status: text("status", {
    enum: ["draft", "pending_review", "approved", "rejected", "suspended"],
  })
    .notNull()
    .default("draft"),
  onboardingStep: text("onboarding_step", {
    enum: ["profile", "kyc", "submitted", "complete"],
  })
    .notNull()
    .default("profile"),
  rejectionReason: text("rejection_reason"),
  approvedAt: text("approved_at"),
  approvedByUserId: uuid("approved_by_user_id"),
  chargeId: uuid("charge_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const charges = pgTable("charges", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  fixedFee: real("fixed_fee").notNull().default(0),
  percentFee: real("percent_fee").notNull().default(0),
  minFee: real("min_fee"),
  maxFee: real("max_fee"),
  currency: text("currency").notNull().default("XAF"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const companyKycDocuments = pgTable("company_kyc_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  documentType: text("document_type", {
    enum: [
      "business_registration",
      "tax_certificate",
      "director_id",
      "bank_statement",
      "other",
    ],
  }).notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  storageKey: text("storage_key").notNull(),
  fileUrl: text("file_url"),
  uploadedByUserId: uuid("uploaded_by_user_id"),
  createdAt: createdAt(),
})

export const companyReviewEvents = pgTable("company_review_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").notNull(),
  action: text("action", {
    enum: ["submitted", "approved", "rejected", "suspended", "charge_assigned"],
  }).notNull(),
  reason: text("reason"),
  metadata: text("metadata"),
  createdAt: createdAt(),
})

export const wallets = pgTable(
  "wallets",
  {
    // One wallet per company — payroll funds are company-owned, not per-user.
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    balance: real("balance").notNull().default(0),
    currency: text("currency").notNull().default("XAF"),
    momoAccountId: text("momo_account_id"),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("wallets_company_id_unique").on(table.companyId)]
)

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  department: text("department"),
  jobTitle: text("job_title"),
  employmentType: text("employment_type", {
    enum: ["full_time", "part_time", "contractor"],
  })
    .notNull()
    .default("full_time"),
  startDate: text("start_date"),
  baseSalary: real("base_salary"),
  taxId: text("tax_id"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  mobileCarrier: text("mobile_carrier", {
    enum: ["mtn", "orange", "nexttel", "camtel", "unknown"],
  }),
  mobileAccountValid: boolean("mobile_account_valid"),
  mobileAccountValidatedAt: text("mobile_account_validated_at"),
  mobileAccountValidationError: text("mobile_account_validation_error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const payRuns = pgTable("pay_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  reference: text("reference").notNull(),
  payPeriod: text("pay_period").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status", {
    enum: ["draft", "pending", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  scheduledAt: text("scheduled_at"),
  processedAt: text("processed_at"),
  createdBy: uuid("created_by"),
  platformFeeAmount: real("platform_fee_amount").notNull().default(0),
  platformChargeId: uuid("platform_charge_id").references(() => charges.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const payRunEmployees = pgTable(
  "pay_run_employees",
  {
    payRunId: uuid("pay_run_id")
      .notNull()
      .references(() => payRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.payRunId, table.employeeId] })]
)

export const payrollTransactions = pgTable("payroll_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  payRunId: uuid("pay_run_id")
    .notNull()
    .references(() => payRuns.id, { onDelete: "cascade" }),
  payRunReference: text("pay_run_reference").notNull(),
  payPeriod: text("pay_period").notNull(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  grossAmount: real("gross_amount").notNull(),
  deductions: real("deductions").notNull().default(0),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  employeePhone: text("employee_phone"),
  reference: text("reference").notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  failureReason: text("failure_reason"),
  paidAt: text("paid_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const mobilePaymentTransactions = pgTable("mobile_payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  walletId: uuid("wallet_id").references(() => wallets.id, {
    onDelete: "set null",
  }),
  externalReferenceId: text("external_reference_id").notNull().unique(),
  type: text("type", { enum: ["collection", "disbursement"] }).notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  partyId: text("party_id").notNull(),
  provider: text("provider"),
  externalId: text("external_id"),
  payerMessage: text("payer_message"),
  payeeNote: text("payee_note"),
  status: text("status", {
    enum: ["pending", "successful", "failed"],
  })
    .notNull()
    .default("pending"),
  providerStatus: text("provider_status"),
  financialTransactionId: text("financial_transaction_id"),
  failureReason: text("failure_reason"),
  payRunId: uuid("pay_run_id").references(() => payRuns.id, {
    onDelete: "set null",
  }),
  payrollTransactionId: uuid("payroll_transaction_id").references(
    () => payrollTransactions.id,
    { onDelete: "set null" }
  ),
  idempotencyKey: text("idempotency_key"),
  jobId: text("job_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    operation: text("operation", {
      enum: ["mobile_disburse", "mobile_collect", "payroll_bulk_disburse"],
    }).notNull(),
    requestHash: text("request_hash").notNull(),
    responseBody: text("response_body"),
    statusCode: integer("status_code"),
    status: text("status", {
      enum: ["processing", "completed", "failed"],
    })
      .notNull()
      .default("processing"),
    createdAt: createdAt(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [uniqueIndex("idempotency_company_key").on(table.companyId, table.key)]
)

export const paymentLogs = pgTable("payment_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  level: text("level", { enum: ["debug", "info", "warn", "error"] }).notNull(),
  event: text("event").notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"),
  mobilePaymentTransactionId: uuid("mobile_payment_transaction_id"),
  jobId: text("job_id"),
  createdAt: createdAt(),
})

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["owner", "admin", "manager", "viewer"] }).notNull(),
  status: text("status", { enum: ["active", "invited"] })
    .notNull()
    .default("invited"),
  createdAt: createdAt(),
})

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  avatar: text("avatar"),
  phone: text("phone"),
  role: text("role", { enum: ["owner", "admin", "manager", "viewer"] }).notNull(),
  isSystemAdmin: boolean("is_system_admin").notNull().default(false),
  status: text("status", { enum: ["active", "invited", "inactive"] })
    .notNull()
    .default("invited"),
  lastLoginAt: text("last_login_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const memberInvites = pgTable("member_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: createdAt(),
})

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  purpose: text("purpose", { enum: ["login"] })
    .notNull()
    .default("login"),
  otpCodeHash: text("otp_code_hash").notNull(),
  otpAttempts: integer("otp_attempts").notNull().default(0),
  maxOtpAttempts: integer("max_otp_attempts").notNull().default(5),
  expiresAt: text("expires_at").notNull(),
  lastSentAt: text("last_sent_at").notNull(),
  notificationId: uuid("notification_id"),
  createdAt: createdAt(),
})

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  type: text("type", {
    enum: [
      "otp",
      "company_approved",
      "company_rejected",
      "kyc_submitted",
      "payroll_info",
      "member_invite",
      "general",
    ],
  }).notNull(),
  channel: text("channel", { enum: ["email", "in_app"] }).notNull(),
  status: text("status", {
    enum: ["pending", "sent", "failed", "read"],
  })
    .notNull()
    .default("pending"),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  templateKey: text("template_key"),
  bodyPreview: text("body_preview"),
  metadata: text("metadata"),
  provider: text("provider", { enum: ["resend", "console"] })
    .notNull()
    .default("resend"),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  sentAt: text("sent_at"),
  readAt: text("read_at"),
  createdAt: createdAt(),
})
