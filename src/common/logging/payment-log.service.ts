import { createId, nowIso } from "../utils/id"
import { logger } from "../logger"
import { db } from "../../db"
import { paymentLogs } from "../../db/schema"

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogParams {
  companyId?: string
  event: string
  message: string
  metadata?: Record<string, unknown>
  mobilePaymentTransactionId?: string
  jobId?: string
  level?: LogLevel
}

async function persist(level: LogLevel, params: LogParams) {
  const entry = {
    id: createId(),
    companyId: params.companyId ?? null,
    level,
    event: params.event,
    message: params.message,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    mobilePaymentTransactionId: params.mobilePaymentTransactionId ?? null,
    jobId: params.jobId ?? null,
    createdAt: nowIso(),
  }

  await db.insert(paymentLogs).values(entry)
  return entry
}

export const paymentLogService = {
  async debug(params: LogParams) {
    logger.debug(params, params.message)
    return persist("debug", params)
  },

  async info(params: LogParams) {
    logger.info(params, params.message)
    return persist("info", params)
  },

  async warn(params: LogParams) {
    logger.warn(params, params.message)
    return persist("warn", params)
  },

  async error(params: LogParams) {
    logger.error(params, params.message)
    return persist("error", params)
  },
}
