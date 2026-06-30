import type { MobileCarrier } from "../../common/utils/phone-carrier"
import type { InstanviProvider, InstanviPaymentType } from "./instanvi-payments.types"

export type InternalPaymentType = "collection" | "disbursement"
export type InternalPaymentStatus = "pending" | "successful" | "failed"

export function carrierToProvider(carrier: MobileCarrier): InstanviProvider | null {
  switch (carrier) {
    case "mtn":
      return "MTN_CAM"
    case "orange":
      return "ORANGE_CAM"
    default:
      return null
  }
}

export function internalTypeToInstanvi(type: InternalPaymentType): InstanviPaymentType {
  return type === "collection" ? "COLLECTION" : "DEPOSIT"
}

export function mapProviderStatus(status: string): InternalPaymentStatus {
  switch (status.toUpperCase()) {
    case "SUCCESS":
    case "SUCCESSFUL":
      return "successful"
    case "FAILED":
      return "failed"
    default:
      return "pending"
  }
}

/** Payroll DB stores whole currency units (e.g. XAF). Instanvi expects integer minor units. */
export function toInstanviAmount(amount: number, currency: string): number {
  const code = currency.toUpperCase()
  if (code === "XAF" || code === "XOF" || code === "JPY") {
    return Math.round(amount)
  }
  return Math.round(amount * 100)
}

export function toInstanviPhoneNumber(national: string): number {
  const digits = national.replace(/\D/g, "")
  const parsed = Number(digits)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid phone number for Instanvi: ${national}`)
  }
  return parsed
}

export function isMobileMoneyCarrier(carrier: MobileCarrier) {
  return carrier === "mtn" || carrier === "orange"
}
