import path from "node:path"

import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://payroll:payroll@localhost:5432/payroll",
})

const tablesWithBoth = [
  "companies",
  "charges",
  "employees",
  "pay_runs",
  "payroll_transactions",
  "mobile_payment_transactions",
  "users",
] as const

const tablesWithCreatedOnly = [
  "company_kyc_documents",
  "company_review_events",
  "idempotency_keys",
  "payment_logs",
  "members",
  "auth_challenges",
  "notifications",
] as const

async function migrate() {
  for (const table of tablesWithBoth) {
    await pool.query(`
      ALTER TABLE ${table}
        ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz,
        ALTER COLUMN created_at SET DEFAULT now(),
        ALTER COLUMN updated_at TYPE timestamptz USING updated_at::timestamptz,
        ALTER COLUMN updated_at SET DEFAULT now();
    `)
    console.log(`  ${table}: created_at, updated_at → timestamptz`)
  }

  for (const table of tablesWithCreatedOnly) {
    await pool.query(`
      ALTER TABLE ${table}
        ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz,
        ALTER COLUMN created_at SET DEFAULT now();
    `)
    console.log(`  ${table}: created_at → timestamptz`)
  }

  console.log("Timestamp migration completed")
}

migrate()
  .catch((error) => {
    console.error("Timestamp migration failed:", error)
    process.exit(1)
  })
  .finally(() => {
    void pool.end()
  })
