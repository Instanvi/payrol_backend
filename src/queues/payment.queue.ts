import { Queue } from "bullmq"
import IORedis from "ioredis"

import { logger } from "../common/logger"
import { env } from "../config/env"

export const PAYMENT_QUEUE_NAME = "payment-processing"

export type DisburseJobData = {
  companyId: string
  idempotencyKey: string
  payRunId?: string
  input: {
    amount: number
    currency: string
    phone: string
    provider?: "MTN_CAM" | "ORANGE_CAM"
    externalId?: string
    payerMessage?: string
    payeeNote?: string
    payrollTransactionId?: string
  }
}

export type DisburseJobName = "disburse"

let sharedRedis: IORedis | null = null

export function getRedisConnection() {
  if (!sharedRedis) {
    const url = env.REDIS_URL
    sharedRedis = new IORedis(url, {
      maxRetriesPerRequest: null,
      ...(url.startsWith("rediss://") ? { tls: {} } : {}),
    })

    sharedRedis.on("error", (err) => {
      logger.error({ err: err.message }, "Redis connection error")
    })
  }

  return sharedRedis
}

export async function verifyRedisConnection() {
  const redis = getRedisConnection()
  const pong = await redis.ping()
  if (pong !== "PONG") {
    throw new Error(`Redis ping failed: ${pong}`)
  }
}

let paymentQueueInstance: Queue<
  DisburseJobData,
  void,
  DisburseJobName
> | null = null

export function getPaymentQueue(): Queue<
  DisburseJobData,
  void,
  DisburseJobName
> {
  if (!paymentQueueInstance) {
    paymentQueueInstance = new Queue<
      DisburseJobData,
      void,
      DisburseJobName
    >(PAYMENT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: env.PAYMENT_QUEUE_ATTEMPTS,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  }

  const queue = paymentQueueInstance
  if (!queue) {
    throw new Error("Payment queue failed to initialize")
  }

  return queue
}

export function disburseJobId(companyId: string, idempotencyKey: string) {
  const safeCompanyId = companyId.replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `disburse_${safeCompanyId}_${safeKey}`
}
