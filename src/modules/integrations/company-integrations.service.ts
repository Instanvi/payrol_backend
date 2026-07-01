import { eq } from "drizzle-orm"

import { paymentLogService } from "../../common/logging/payment-log.service"
import { AppError } from "../../common/errors/AppError"
import {
  decryptSecret,
  encryptSecret,
} from "../../common/utils/secret-crypto"
import { nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { companies } from "../../db/schema"
import {
  createInstanviClient,
  type InstanviPaymentsClient,
} from "../mobile-payments/instanvi-payments.client"
import type { SaveInstanviKeysInput } from "./integrations.validation"

function maskLast4(apiKey: string) {
  const trimmed = apiKey.trim()
  if (trimmed.length < 4) return "••••"
  return `••••${trimmed.slice(-4)}`
}

function isCompanyInstanviConnected(
  row: Pick<
    typeof companies.$inferSelect,
    "instanviApiKeyEncrypted" | "instanviConnectedAt"
  >
) {
  return Boolean(row.instanviApiKeyEncrypted?.trim() && row.instanviConnectedAt)
}

export const companyIntegrationsService = {
  async getMaskedConfig(companyId: string) {
    const row = await findOne(
      db.select().from(companies).where(eq(companies.id, companyId))
    )

    if (!row) throw AppError.notFound("Company not found")

    const connected = isCompanyInstanviConnected(row)

    return {
      connected,
      apiKeyLast4: row.instanviApiKeyLast4 ?? undefined,
      locationId: row.instanviLocationId ?? undefined,
      connectedAt: row.instanviConnectedAt ?? undefined,
    }
  },

  async saveInstanviKeys(companyId: string, input: SaveInstanviKeysInput) {
    const apiKey = input.apiKey.trim()
    const locationId = input.locationId?.trim() || null
    const now = nowIso()

    await db
      .update(companies)
      .set({
        instanviApiKeyEncrypted: encryptSecret(apiKey),
        instanviApiKeyLast4: maskLast4(apiKey),
        instanviLocationId: locationId,
        instanviConnectedAt: now,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId))

    await paymentLogService.info({
      companyId,
      event: "integrations.instanvi.saved",
      message: "Instanvi integration keys saved",
      metadata: {
        apiKeyLast4: maskLast4(apiKey),
        locationId: locationId ?? undefined,
      },
    })

    return this.getMaskedConfig(companyId)
  },

  async clearInstanviKeys(companyId: string) {
    const row = await findOne(
      db.select().from(companies).where(eq(companies.id, companyId))
    )

    if (!row) throw AppError.notFound("Company not found")

    const now = nowIso()
    await db
      .update(companies)
      .set({
        instanviApiKeyEncrypted: null,
        instanviApiKeyLast4: null,
        instanviLocationId: null,
        instanviConnectedAt: null,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId))

    await paymentLogService.info({
      companyId,
      event: "integrations.instanvi.removed",
      message: "Instanvi integration keys removed",
      metadata: {
        apiKeyLast4: row.instanviApiKeyLast4 ?? undefined,
      },
    })

    return this.getMaskedConfig(companyId)
  },

  async getInstanviCredentials(companyId: string) {
    const row = await findOne(
      db.select().from(companies).where(eq(companies.id, companyId))
    )

    if (!row) throw AppError.notFound("Company not found")

    if (row.instanviApiKeyEncrypted?.trim()) {
      return {
        apiKey: decryptSecret(row.instanviApiKeyEncrypted),
        locationId: row.instanviLocationId?.trim() || undefined,
      }
    }

    if (env.INSTANVI_API_KEY?.trim()) {
      return {
        apiKey: env.INSTANVI_API_KEY.trim(),
        locationId: env.INSTANVI_LOCATION_ID?.trim() || undefined,
      }
    }

    throw AppError.validation(
      "Link Instanvi in Settings before running payments."
    )
  },

  async getInstanviClient(companyId: string): Promise<InstanviPaymentsClient> {
    const credentials = await this.getInstanviCredentials(companyId)
    return createInstanviClient(credentials)
  },

  async testInstanviConnection(companyId: string) {
    const client = await this.getInstanviClient(companyId)
    await client.listTransactions({ limit: 1 })

    await paymentLogService.info({
      companyId,
      event: "integrations.instanvi.tested",
      message: "Instanvi connection test succeeded",
    })

    return { ok: true as const }
  },
}
