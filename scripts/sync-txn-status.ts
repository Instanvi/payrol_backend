import dotenv from "dotenv"
import path from "node:path"
import pg from "pg"

import { env } from "../src/config/env.js"
import { mobilePaymentsService } from "../src/modules/mobile-payments/mobile-payments.service.js"

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") })
  const txnId = process.argv[2]
  if (!txnId) {
    console.error("Usage: npx tsx scripts/sync-txn-status.ts <instanvi-transaction-id> [companyId]")
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
  let companyId = process.argv[3]

  if (!companyId) {
    const r = await pool.query<{ company_id: string }>(
      `SELECT company_id FROM mobile_payment_transactions WHERE external_reference_id = $1 LIMIT 1`,
      [txnId]
    )
    companyId = r.rows[0]?.company_id
  }
  await pool.end()

  if (!companyId) {
    console.error("Company not found for transaction", txnId)
    process.exit(1)
  }

  console.log("Syncing", txnId, "for company", companyId)
  const result = await mobilePaymentsService.syncStatus(txnId, companyId)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
