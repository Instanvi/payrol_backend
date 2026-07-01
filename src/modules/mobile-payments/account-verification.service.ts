import { paymentLogService } from "../../common/logging/payment-log.service"
import { AppError } from "../../common/errors/AppError"
import {
  detectCarrier,
  validateCarrierForMobileMoney,
} from "../../common/utils/phone-carrier"
import { companyIntegrationsService } from "../integrations/company-integrations.service"
import type {
  InstanviPaymentType,
  InstanviProvider,
  InstanviVerificationScope,
} from "./instanvi-payments.types"
import { carrierToProvider } from "./provider.utils"

export interface VerifiedMobileAccount {
  phone: string
  e164: string
  carrier: ReturnType<typeof detectCarrier>["carrier"]
  provider: InstanviProvider
  type: InstanviPaymentType
  active: boolean
  verificationScope: InstanviVerificationScope
  accountHolderName?: string | null
}

function formatAccountHolderName(result?: {
  given_name?: string
  family_name?: string
}) {
  if (!result) return null
  const name = [result.given_name, result.family_name].filter(Boolean).join(" ")
  return name || null
}

export async function verifyMobileAccount(
  companyId: string,
  phone: string,
  type: InstanviPaymentType = "DEPOSIT"
): Promise<VerifiedMobileAccount> {
  const carrierCheck = validateCarrierForMobileMoney(phone)
  if (!carrierCheck.ok) {
    throw AppError.validation(carrierCheck.message)
  }

  const msisdn = carrierCheck.parsed.national
  const provider = carrierToProvider(carrierCheck.parsed.carrier)
  if (!provider) {
    throw AppError.validation(
      `Carrier ${carrierCheck.parsed.carrier} is not supported for mobile money payments`
    )
  }

  const instanvi = await companyIntegrationsService.getInstanviClient(companyId)

  const active = await instanvi.verifyAccountHolderActive(msisdn, type, provider)

  if (!active.result) {
    const message =
      provider === "ORANGE_CAM"
        ? "Orange mobile money wallet could not be confirmed for this number"
        : "Mobile money account is not registered or not active for this phone number"

    await paymentLogService.info({
      companyId,
      event: "mobile_payments.account.inactive",
      message,
      metadata: {
        phone: msisdn,
        provider,
        type,
        verificationScope: active.verificationScope,
      },
    })

    throw AppError.validation(message)
  }

  let accountHolderName: string | null = null

  if (provider === "MTN_CAM") {
    try {
      const basicInfo = await instanvi.verifyAccountHolderBasicInfo(
        msisdn,
        type,
        provider
      )
      accountHolderName = formatAccountHolderName(basicInfo.result)
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 501) {
        accountHolderName = null
      } else if (error instanceof AppError && error.statusCode === 404) {
        accountHolderName = null
      } else {
        throw error
      }
    }
  }

  await paymentLogService.info({
    companyId,
    event: "mobile_payments.account.verified",
    message: "Mobile money account verified via Instanvi",
    metadata: {
      phone: msisdn,
      provider,
      type,
      verificationScope: active.verificationScope,
      accountHolderName,
    },
  })

  return {
    phone: msisdn,
    e164: carrierCheck.parsed.e164,
    carrier: carrierCheck.parsed.carrier,
    provider,
    type,
    active: true,
    verificationScope: active.verificationScope,
    accountHolderName,
  }
}

/** Soft check for employee validation — returns result without throwing. */
export async function checkMobileAccount(
  companyId: string,
  phone: string,
  type: InstanviPaymentType = "DEPOSIT"
) {
  const carrierCheck = validateCarrierForMobileMoney(phone)
  if (!carrierCheck.ok) {
    return {
      ok: false as const,
      phone: carrierCheck.parsed.national || null,
      carrier: carrierCheck.parsed.carrier,
      error: carrierCheck.message,
    }
  }

  const msisdn = carrierCheck.parsed.national
  const provider = carrierToProvider(carrierCheck.parsed.carrier)
  if (!provider) {
    return {
      ok: false as const,
      phone: msisdn,
      carrier: carrierCheck.parsed.carrier,
      error: `Carrier ${carrierCheck.parsed.carrier} is not supported for mobile money payroll`,
    }
  }

  try {
    const instanvi = await companyIntegrationsService.getInstanviClient(companyId)
    const active = await instanvi.verifyAccountHolderActive(msisdn, type, provider)

    if (!active.result) {
      const error =
        provider === "ORANGE_CAM"
          ? "Orange prefix is valid but wallet could not be confirmed — payment may still fail"
          : "Mobile money account is not registered or not active"

      return {
        ok: false as const,
        phone: msisdn,
        carrier: carrierCheck.parsed.carrier,
        provider,
        verificationScope: active.verificationScope,
        error,
      }
    }

    let accountHolderName: string | null = null
    if (provider === "MTN_CAM") {
      try {
        const basicInfo = await instanvi.verifyAccountHolderBasicInfo(
          msisdn,
          type,
          provider
        )
        accountHolderName = formatAccountHolderName(basicInfo.result)
      } catch {
        accountHolderName = null
      }
    }

    const prefixOnly = active.verificationScope === "network_prefix_only"

    return {
      ok: true as const,
      phone: msisdn,
      carrier: carrierCheck.parsed.carrier,
      provider,
      verificationScope: active.verificationScope,
      accountHolderName,
      mobileEligible: true,
      warning: prefixOnly
        ? "Verified by Orange prefix only — wallet existence is confirmed at payment time"
        : undefined,
    }
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Mobile money account verification failed"

    return {
      ok: false as const,
      phone: msisdn,
      carrier: carrierCheck.parsed.carrier,
      provider,
      error: message,
    }
  }
}
