import { Queue } from "bullmq"

import { env } from "../config/env"

export const PAYMENT_QUEUE_NAME = "payment-processing"

export type DisburseJobData = {
  companyId: string
  idempotencyKey: string
  payRunId?: string
  skipWalletDebit?: boolean
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

export const redisConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableOfflineQueue: false,
} as const

let paymentQueueInstance: Queue<
  DisburseJobData,
  void,
  DisburseJobName
> | null = null

export function getPaymentQueue() {
  if (!paymentQueueInstance) {
    paymentQueueInstance = new Queue<
      DisburseJobData,
      void,
      DisburseJobName
    >(PAYMENT_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: env.PAYMENT_QUEUE_ATTEMPTS,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  }

  return paymentQueueInstance
}

export function disburseJobId(companyId: string, idempotencyKey: string) {
  return `disburse:${companyId}:${idempotencyKey}`
}
