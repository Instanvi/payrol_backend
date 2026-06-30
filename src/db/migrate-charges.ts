import path from "node:path"

import dotenv from "dotenv"
import pg from "pg"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://payroll:payroll@localhost:5432/payroll",
})

async function tableExists(name: string) {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  )
  return (result.rowCount ?? 0) > 0
}

async function migrate() {
  if (await tableExists("fee_plans")) {
    await pool.query(`ALTER TABLE fee_plans RENAME TO charges`)
    console.log("  fee_plans → charges")
  } else if (await tableExists("charges")) {
    console.log("  charges table already exists — skipping rename")
  }

  if (await tableExists("companies")) {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'companies'
       AND column_name IN ('fee_plan_id', 'charge_id')`
    )
    const names = cols.rows.map((r) => r.column_name as string)
    if (names.includes("fee_plan_id") && !names.includes("charge_id")) {
      await pool.query(
        `ALTER TABLE companies RENAME COLUMN fee_plan_id TO charge_id`
      )
      console.log("  companies.fee_plan_id → charge_id")
    }
  }

  if (await tableExists("pay_runs")) {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'pay_runs'
       AND column_name IN ('platform_fee_plan_id', 'platform_charge_id')`
    )
    const names = cols.rows.map((r) => r.column_name as string)
    if (
      names.includes("platform_fee_plan_id") &&
      !names.includes("platform_charge_id")
    ) {
      await pool.query(
        `ALTER TABLE pay_runs RENAME COLUMN platform_fee_plan_id TO platform_charge_id`
      )
      console.log("  pay_runs.platform_fee_plan_id → platform_charge_id")
    }
  }

  await pool.query(`
    UPDATE company_review_events
    SET action = 'charge_assigned'
    WHERE action = 'fee_assigned'
  `)

  console.log("Charges rename migration completed")
}

migrate()
  .catch((error) => {
    console.error("Charges rename migration failed:", error)
    process.exit(1)
  })
  .finally(() => {
    void pool.end()
  })
