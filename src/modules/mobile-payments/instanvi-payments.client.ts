import axios, { isAxiosError, type AxiosInstance } from "axios"

import { AppError } from "../../common/errors/AppError"
import { env } from "../../config/env"
import type {
  InstanviEnvelope,
  InstanviListTransactionsData,
  InstanviListTransactionsQuery,
  InstanviMakePaymentBody,
  InstanviMakePaymentData,
  InstanviPaymentRow,
  InstanviPaymentType,
  InstanviVerifyActiveData,
  InstanviVerifyBasicInfoData,
} from "./instanvi-payments.types"

function assertInstanviConfigured() {
  if (!env.INSTANVI_API_KEY?.trim()) {
    throw AppError.validation(
      "Instanvi payments API key is not configured. Set INSTANVI_API_KEY."
    )
  }
  if (!env.INSTANVI_PAYMENTS_BASE_URL?.trim()) {
    throw AppError.validation(
      "Instanvi payments base URL is not configured. Set INSTANVI_PAYMENTS_BASE_URL."
    )
  }
}

function baseHeaders(): Record<string, string> {
  assertInstanviConfigured()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": env.INSTANVI_API_KEY!,
  }
  if (env.INSTANVI_LOCATION_ID?.trim()) {
    headers["x-location-id"] = env.INSTANVI_LOCATION_ID.trim()
  }
  return headers
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
    throw new AppError(
      body.message || parseEnvelopeError(body.status_code, body),
      body.status_code >= 500 ? 502 : body.status_code,
      "INSTANVI_PAYMENTS_FAILED"
    )
  }
  return body.data
}

const instanviHttp: AxiosInstance = axios.create({
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
})

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

export const instanviPaymentsClient = {
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

  async verifyAccountHolderActive(phoneNumber: string, type: InstanviPaymentType) {
    const data = await request<InstanviVerifyActiveData>(
      "get",
      "/verify-account-holder-active",
      { params: { phoneNumber, type } }
    )

    if (!data.result) {
      throw AppError.validation(
        "Mobile money account is not registered or not active for this phone number"
      )
    }

    return data
  },

  verifyAccountHolderBasicInfo(phoneNumber: string, type: InstanviPaymentType) {
    return request<InstanviVerifyBasicInfoData>(
      "get",
      "/verify-account-holder-basic-info",
      { params: { phoneNumber, type } }
    )
  },
}
