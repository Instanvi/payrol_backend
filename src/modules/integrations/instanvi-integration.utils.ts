import { env } from "../../config/env"
import type { companies } from "../../db/schema"

export const INSTANVI_API_KEY_PATTERN = /^app_[a-zA-Z0-9_]+$/

export function isValidInstanviApiKey(apiKey: string) {
  const trimmed = apiKey.trim()
  return trimmed.length >= 12 && INSTANVI_API_KEY_PATTERN.test(trimmed)
}

export function hasEnvInstanviFallback() {
  const apiKey = env.INSTANVI_API_KEY?.trim()
  return Boolean(apiKey && isValidInstanviApiKey(apiKey))
}

export function isCompanyInstanviConfigured(
  row: Pick<
    typeof companies.$inferSelect,
    "instanviApiKeyEncrypted" | "instanviConnectedAt"
  >
) {
  return Boolean(row.instanviApiKeyEncrypted?.trim() && row.instanviConnectedAt)
}

export function isInstanviPaymentsAvailable(
  row: Pick<
    typeof companies.$inferSelect,
    "instanviApiKeyEncrypted" | "instanviConnectedAt"
  >
) {
  return isCompanyInstanviConfigured(row) || hasEnvInstanviFallback()
}
