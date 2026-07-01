import axios, { isAxiosError, type AxiosInstance } from "axios"

import { AppError } from "../../common/errors/AppError"
import { attachHttpClientLogging } from "../../common/logging/http-client-logger"
import { env } from "../../config/env"
import type {
  InstanviEnvelope,
  InstanviListTransactionsData,
  InstanviListTransactionsQuery,
  InstanviMakePaymentBody,
  InstanviMakePaymentData,
  InstanviPaymentRow,
  InstanviPaymentType,
  InstanviProvider,
  InstanviVerifyActiveData,
  InstanviVerifyBasicInfoData,
} from "./instanvi-payments.types"

export interface InstanviClientCredentials {
  apiKey: string
  locationId?: string
}

function assertInstanviBaseUrlConfigured() {
  if (!env.INSTANVI_PAYMENTS_BASE_URL?.trim()) {
    throw AppError.validation(
      "Instanvi payments base URL is not configured. Set INSTANVI_PAYMENTS_BASE_URL."
    )
  }
}

function parseEnvelopeError<T>(
  status: number,
  body: InstanviEnvelope<T> | unknown
): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = String((body as InstanviEnvelope<T>).message ?? "")
    if (message) return message
  }
  return `Instanvi payments API error (${status})`
}

function unwrapEnvelope<T>(body: InstanviEnvelope<T>): T {
  if (body.status_code >= 400) {
    const statusCode =
      body.status_code >= 400 && body.status_code < 600
        ? body.status_code
        : 502
    throw new AppError(
      body.message || parseEnvelopeError(body.status_code, body),
      statusCode,
      "INSTANVI_PAYMENTS_FAILED"
    )
  }
  return body.data
}

const instanviHttp: AxiosInstance = axios.create({
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
})

attachHttpClientLogging(instanviHttp, "instanvi")

export type InstanviPaymentsClient = ReturnType<typeof createInstanviClient>

export function createInstanviClient(credentials: InstanviClientCredentials) {
  const apiKey = credentials.apiKey.trim()
  const locationId = credentials.locationId?.trim()

  function assertApiKeyConfigured() {
    if (!apiKey) {
      throw AppError.validation(
        "Link Instanvi in Settings before running payments."
      )
    }
    if (!/^app_[a-zA-Z0-9_]+$/.test(apiKey) || apiKey.length < 12) {
      throw AppError.validation(
        "Instanvi API key is invalid. Expected format: app_<token>"
      )
    }
  }

  function baseHeaders(): Record<string, string> {
    assertApiKeyConfigured()
    assertInstanviBaseUrlConfigured()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    }
    if (locationId) {
      headers["x-location-id"] = locationId
    }
    return headers
  }

  async function request<T>(
    method: "get" | "post",
    path: string,
    options?: { params?: Record<string, unknown>; body?: unknown }
  ): Promise<T> {
    const baseURL = env.INSTANVI_PAYMENTS_BASE_URL!.replace(/\/$/, "")

    try {
      const response = await instanviHttp.request<InstanviEnvelope<T>>({
        method,
        baseURL,
        url: path,
        headers: baseHeaders(),
        params: options?.params,
        data: options?.body,
        validateStatus: () => true,
      })

      if (response.status === 401) {
        throw new AppError(
          parseEnvelopeError(response.status, response.data),
          401,
          "INSTANVI_AUTH_FAILED"
        )
      }

      if (response.status >= 400 && !response.data?.status_code) {
        throw new AppError(
          parseEnvelopeError(response.status, response.data),
          response.status >= 500 ? 502 : response.status,
          "INSTANVI_PAYMENTS_FAILED"
        )
      }

      return unwrapEnvelope(response.data)
    } catch (error) {
      if (error instanceof AppError) throw error
      const message = isAxiosError(error)
        ? parseEnvelopeError(error.response?.status ?? 0, error.response?.data)
        : "Instanvi payments request failed"
      throw new AppError(message, 502, "INSTANVI_PAYMENTS_FAILED")
    }
  }

  return {
    makePayment(body: InstanviMakePaymentBody) {
      return request<InstanviMakePaymentData>("post", "/make-payment", { body })
    },

    getTransaction(transactionId: string) {
      return request<InstanviPaymentRow>(
        "get",
        `/transactions/${encodeURIComponent(transactionId)}`
      )
    },

    listTransactions(query: InstanviListTransactionsQuery = {}) {
      return request<InstanviListTransactionsData>("get", "/transactions", {
        params: query as Record<string, unknown>,
      })
    },

    verifyAccountHolderActive(
      phoneNumber: string,
      type: InstanviPaymentType,
      provider?: InstanviProvider
    ) {
      const params: Record<string, string> = { phoneNumber, type }
      if (provider) params.provider = provider

      return request<InstanviVerifyActiveData>(
        "get",
        "/verify-account-holder-active",
        { params }
      )
    },

    verifyAccountHolderBasicInfo(
      phoneNumber: string,
      type: InstanviPaymentType,
      provider?: InstanviProvider
    ) {
      const params: Record<string, string> = { phoneNumber, type }
      if (provider) params.provider = provider

      return request<InstanviVerifyBasicInfoData>(
        "get",
        "/verify-account-holder-basic-info",
        { params }
      )
    },
  }
}

export function assertInstanviConfigured() {
  assertInstanviBaseUrlConfigured()
}
