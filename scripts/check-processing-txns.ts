import dotenv from "dotenv"
import path from "node:path"
import pg from "pg"

import { env } from "../src/config/env.js"

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") })
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
  const r = await pool.query(`
    SELECT pt.id, pt.reference, pt.status, pt.employee_name, pt.updated_at,
           m.external_reference_id, m.status as mobile_status, m.provider_status, m.updated_at as mobile_updated
    FROM payroll_transactions pt
    LEFT JOIN mobile_payment_transactions m ON m.payroll_transaction_id = pt.id
    WHERE pt.status = 'processing'
    ORDER BY pt.updated_at DESC
    LIMIT 10
  `)
  console.log(JSON.stringify(r.rows, null, 2))
  await pool.end()
}

main().catch(console.error)
