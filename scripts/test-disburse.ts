import dotenv from "dotenv"
import path from "node:path"
import pg from "pg"

import { env } from "../src/config/env.js"
import { mobilePaymentsService } from "../src/modules/mobile-payments/mobile-payments.service.js"

async function resolveCompanyId(pool: pg.Pool, phone: string) {
  const byPhone = await pool.query<{ company_id: string }>(
    `SELECT company_id FROM employees
     WHERE phone LIKE $1 OR phone LIKE $2
     LIMIT 1`,
    [`%${phone}`, `%${phone.slice(-9)}`]
  )

  if (byPhone.rows[0]?.company_id) {
    return byPhone.rows[0].company_id
  }

  const fallback = await pool.query<{ id: string }>(
    `SELECT id FROM companies ORDER BY created_at ASC LIMIT 1`
  )

  return fallback.rows[0]?.id ?? env.DEFAULT_COMPANY_ID
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") })

  const phone = process.argv[2] ?? "653878190"
  const amount = Number(process.argv[3] ?? "100")
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
  const companyId = await resolveCompanyId(pool, phone)
  await pool.end()

  console.log("Disbursing", amount, "XAF to", phone, "for company", companyId)
  console.log("Using Instanvi key from env:", Boolean(env.INSTANVI_API_KEY?.trim()))

  const idempotencyKey = `manual-test-${Date.now()}`

  const queued = await mobilePaymentsService.queueDisburse(
    companyId,
    {
      amount,
      currency: "XAF",
      phone,
      payerMessage: "Manual test disbursement",
      payeeNote: "Test payment",
    },
    idempotencyKey
  )

  console.log("Queued:", queued)

  await new Promise((resolve) => setTimeout(resolve, 12000))

  const transactions = await mobilePaymentsService.listByCompany(companyId)
  const latest = transactions
    .filter((txn) => txn.partyId?.includes(phone.slice(-9)))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]

  if (latest?.transactionId) {
    const status = await mobilePaymentsService.syncStatus(
      latest.transactionId,
      companyId
    )
    console.log("Latest transaction status:", status)
  } else {
    console.log("No matching transaction found yet — check worker logs")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
