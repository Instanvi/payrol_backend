import type { Worker } from "bullmq"

import { createApp } from "./app"
import { env } from "./config/env"
import { logger } from "./common/logger"
import {
  verifyRedisConnection,
  type DisburseJobData,
  type DisburseJobName,
} from "./queues/payment.queue"
import { startPaymentWorker } from "./queues/payment.worker"
import { pool } from "./db"

const app = createApp()

let worker: Worker<DisburseJobData, void, DisburseJobName> | null = null

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, worker: env.RUN_PAYMENT_WORKER },
    `API server running on port ${env.PORT}`
  )

  if (env.RUN_PAYMENT_WORKER) {
    void verifyRedisConnection()
      .then(() => {
        worker = startPaymentWorker()
      })
      .catch((err) => {
        logger.error(
          { err },
          "Payment worker not started — Redis is unavailable. Disburse jobs will queue but not run."
        )
      })
  }
})

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down")
  server.close()
  if (worker) await worker.close()
  await pool.end()
  process.exit(0)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
