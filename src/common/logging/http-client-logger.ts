import type { AxiosInstance, InternalAxiosRequestConfig } from "axios"
import { isAxiosError } from "axios"

import { logger } from "../logger"

const SENSITIVE_HEADERS = new Set(["x-api-key", "authorization"])

function redactHeaders(
  headers: InternalAxiosRequestConfig["headers"]
): Record<string, string> {
  if (!headers) return {}

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue
    const lower = key.toLowerCase()
    normalized[key] = SENSITIVE_HEADERS.has(lower)
      ? "[redacted]"
      : String(value)
  }
  return normalized
}

function requestUrl(config: InternalAxiosRequestConfig) {
  const base = config.baseURL?.replace(/\/$/, "") ?? ""
  const path = config.url ?? ""
  return `${base}${path}`
}

function truncateJson(value: unknown, max = 2000) {
  if (value === undefined || value === null) return undefined
  const raw = typeof value === "string" ? value : JSON.stringify(value)
  if (!raw) return undefined
  return raw.length > max ? `${raw.slice(0, max)}…` : raw
}

function logTimestamp() {
  return new Date().toISOString()
}

export function attachHttpClientLogging(client: AxiosInstance, name: string) {
  client.interceptors.request.use((config) => {
    logger.info(
      {
        type: "http.outgoing",
        timestamp: logTimestamp(),
        client: name,
        direction: "request",
        method: config.method?.toUpperCase(),
        url: requestUrl(config),
        params: config.params,
        headers: redactHeaders(config.headers),
        body: truncateJson(config.data),
      },
      "Outgoing HTTP request"
    )
    return config
  })

  client.interceptors.response.use(
    (response) => {
      logger.info(
        {
          type: "http.outgoing",
          timestamp: logTimestamp(),
          client: name,
          direction: "response",
          method: response.config.method?.toUpperCase(),
          url: requestUrl(response.config),
          status: response.status,
          body: truncateJson(response.data),
        },
        "Outgoing HTTP response"
      )
      return response
    },
    (error) => {
      if (isAxiosError(error)) {
        logger.warn(
          {
            type: "http.outgoing",
            timestamp: logTimestamp(),
            client: name,
            direction: "response",
            method: error.config?.method?.toUpperCase(),
            url: error.config ? requestUrl(error.config) : undefined,
            status: error.response?.status,
            body: truncateJson(error.response?.data),
            message: error.message,
          },
          "Outgoing HTTP response error"
        )
      }
      return Promise.reject(error)
    }
  )
}
