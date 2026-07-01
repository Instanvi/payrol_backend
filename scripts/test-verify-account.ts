import dotenv from "dotenv"
import path from "node:path"

import { env } from "../src/config/env.js"
import { createInstanviClient } from "../src/modules/mobile-payments/instanvi-payments.client.js"
import type { InstanviPaymentType } from "../src/modules/mobile-payments/instanvi-payments.types.js"

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") })

  const phone = process.argv[2] ?? "653878190"
  const type = (process.argv[3]?.toUpperCase() ?? "DEPOSIT") as InstanviPaymentType

  if (type !== "DEPOSIT" && type !== "COLLECTION") {
    throw new Error('Payment type must be "DEPOSIT" or "COLLECTION"')
  }

  const apiKey = env.INSTANVI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("INSTANVI_API_KEY is not set in .env")
  }

  const baseUrl = env.INSTANVI_PAYMENTS_BASE_URL
  console.log("Instanvi base URL:", baseUrl)
  console.log("Verifying account holder basic info")
  console.log("  phone:", phone)
  console.log("  type:", type)
  console.log(
    "  endpoint:",
    `${baseUrl.replace(/\/$/, "")}/verify-account-holder-basic-info`
  )

  const client = createInstanviClient({
    apiKey,
    locationId: env.INSTANVI_LOCATION_ID,
  })

  const basicInfo = await client.verifyAccountHolderBasicInfo(phone, type)
  console.log("\nBasic info response:")
  console.log(JSON.stringify(basicInfo, null, 2))

  try {
    const active = await client.verifyAccountHolderActive(phone, type)
    console.log("\nActive check response:")
    console.log(JSON.stringify(active, null, 2))
  } catch (error) {
    console.warn(
      "\nActive check failed:",
      error instanceof Error ? error.message : error
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
