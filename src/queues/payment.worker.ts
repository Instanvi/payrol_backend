import { Worker } from "bullmq"

import { paymentLogService } from "../common/logging/payment-log.service"
import { logger } from "../common/logger"
import { env } from "../config/env"
import { mobilePaymentsService } from "../modules/mobile-payments/mobile-payments.service"
import {
  PAYMENT_QUEUE_NAME,
  redisConnection,
  type DisburseJobData,
  type DisburseJobName,
} from "./payment.queue"

export function startPaymentWorker() {
  const worker = new Worker<DisburseJobData, void, DisburseJobName>(
    PAYMENT_QUEUE_NAME,
    async (job) => {
      await paymentLogService.info({
        companyId: job.data.companyId,
        event: "payment.job.started",
        message: "Processing disbursement job",
        jobId: job.id,
        metadata: {
          idempotencyKey: job.data.idempotencyKey,
          amount: job.data.input.amount,
          phone: job.data.input.phone,
        },
      })

      await mobilePaymentsService.executeDisburse(
        job.data.companyId,
        job.data.input,
        {
          idempotencyKey: job.data.idempotencyKey,
          jobId: job.id ?? undefined,
          payRunId: job.data.payRunId,
          skipWalletDebit: job.data.skipWalletDebit,
        }
      )

      await paymentLogService.info({
        companyId: job.data.companyId,
        event: "payment.job.completed",
        message: "Disbursement job completed",
        jobId: job.id,
        metadata: { idempotencyKey: job.data.idempotencyKey },
      })
    },
    {
      connection: redisConnection,
      concurrency: env.PAYMENT_QUEUE_CONCURRENCY,
    }
  )

  worker.on("failed", (job, error) => {
    logger.error(
      { err: error, jobId: job?.id, companyId: job?.data.companyId },
      "Payment job failed"
    )

    if (job?.data) {
      void paymentLogService.error({
        companyId: job.data.companyId,
        event: "payment.job.failed",
        message: error.message,
        jobId: job.id,
        metadata: {
          idempotencyKey: job.data.idempotencyKey,
          attemptsMade: job.attemptsMade,
        },
      })
    }
  })

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Payment job completed")
  })

  logger.info("Payment worker started")
  return worker
}
