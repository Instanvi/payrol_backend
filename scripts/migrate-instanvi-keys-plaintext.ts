import dotenv from "dotenv"
import path from "node:path"
import pg from "pg"

import {
  readIntegrationSecret,
  storeIntegrationSecret,
} from "../src/common/utils/integration-secrets.js"
import { isValidInstanviApiKey } from "../src/modules/integrations/instanvi-integration.utils.js"
import { env } from "../src/config/env.js"

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") })
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL })

  const { rows } = await pool.query<{
    id: string
    name: string
    instanvi_api_key_encrypted: string | null
    instanvi_api_key_last4: string | null
  }>(
    `SELECT id, name, instanvi_api_key_encrypted, instanvi_api_key_last4
     FROM companies
     WHERE instanvi_api_key_encrypted IS NOT NULL`
  )

  let migrated = 0
  let invalid = 0

  for (const row of rows) {
    const stored = row.instanvi_api_key_encrypted?.trim()
    if (!stored) continue

    const apiKey = readIntegrationSecret(stored)
    if (!isValidInstanviApiKey(apiKey)) {
      console.warn(
        `SKIP ${row.name} (${row.id}): invalid key after read (last4 ${row.instanvi_api_key_last4})`
      )
      invalid++
      continue
    }

    const plaintext = storeIntegrationSecret(apiKey)
    if (plaintext === stored) {
      console.log(`OK ${row.name}: already plaintext`)
      continue
    }

    await pool.query(
      `UPDATE companies SET instanvi_api_key_encrypted = $1, updated_at = NOW() WHERE id = $2`,
      [plaintext, row.id]
    )
    console.log(`MIGRATED ${row.name} (${row.id}) to plaintext storage`)
    migrated++
  }

  console.log(`Done. migrated=${migrated} invalid=${invalid} total=${rows.length}`)
  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
