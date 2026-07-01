import dotenv from "dotenv"
import path from "node:path"

import { detectCarrier } from "../src/common/utils/phone-carrier.js"
import { env } from "../src/config/env.js"
import { createInstanviClient } from "../src/modules/mobile-payments/instanvi-payments.client.js"
import { carrierToProvider } from "../src/modules/mobile-payments/provider.utils.js"
import type { InstanviPaymentType } from "../src/modules/mobile-payments/instanvi-payments.types.js"

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") })

  const rawPhone = process.argv[2] ?? "653878190"
  const type = (process.argv[3]?.toUpperCase() ?? "DEPOSIT") as InstanviPaymentType

  if (type !== "DEPOSIT" && type !== "COLLECTION") {
    throw new Error('Payment type must be "DEPOSIT" or "COLLECTION"')
  }

  const apiKey = env.INSTANVI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("INSTANVI_API_KEY is not set in .env")
  }

  const parsed = detectCarrier(rawPhone)
  if (!parsed.valid) {
    throw new Error(parsed.error ?? "Invalid phone number")
  }

  const phoneNumber = parsed.national
  const provider = carrierToProvider(parsed.carrier)
  const baseUrl = env.INSTANVI_PAYMENTS_BASE_URL.replace(/\/$/, "")

  console.log("Instanvi base URL:", baseUrl)
  console.log("Step 1 — verify-account-holder-active")
  console.log("  phoneNumber:", phoneNumber)
  console.log("  type:", type)
  console.log("  provider:", provider ?? "(auto)")
  console.log(
    "  url:",
    `${baseUrl}/verify-account-holder-active?phoneNumber=${phoneNumber}&type=${type}${provider ? `&provider=${provider}` : ""}`
  )

  const client = createInstanviClient({
    apiKey,
    locationId: env.INSTANVI_LOCATION_ID,
  })

  const active = await client.verifyAccountHolderActive(
    phoneNumber,
    type,
    provider ?? undefined
  )

  console.log("\nActive check response:")
  console.log(JSON.stringify(active, null, 2))

  if (!active.result) {
    console.error("\nAccount is not active — block payment.")
    process.exit(1)
  }

  if (active.provider === "MTN_CAM" || parsed.carrier === "mtn") {
    console.log("\nStep 2 — verify-account-holder-basic-info (MTN only)")
    console.log(
      "  url:",
      `${baseUrl}/verify-account-holder-basic-info?phoneNumber=${phoneNumber}&type=${type}&provider=MTN_CAM`
    )

    try {
      const basicInfo = await client.verifyAccountHolderBasicInfo(
        phoneNumber,
        type,
        "MTN_CAM"
      )
      console.log("\nBasic info response:")
      console.log(JSON.stringify(basicInfo, null, 2))

      const name = [
        basicInfo.result.given_name,
        basicInfo.result.family_name,
      ]
        .filter(Boolean)
        .join(" ")

      if (name) {
        console.log(`\nPayee name: ${name}`)
      }
    } catch (error) {
      console.warn(
        "\nBasic info lookup failed (optional for disburse):",
        error instanceof Error ? error.message : error
      )
    }
  } else {
    console.log(
      "\nStep 2 skipped — Orange basic info is not supported (expect 501)."
    )
    if (active.verificationScope === "network_prefix_only") {
      console.log(
        "Orange verified by prefix only — proceed to make-payment with provider ORANGE_CAM."
      )
    }
  }

  console.log("\nReady for make-payment with the same phoneNumber, type, and provider.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
