import { createApp } from "./app"
import { env } from "./config/env"
import { logger } from "./common/logger"
import { startPaymentWorker } from "./queues/payment.worker"
import { pool } from "./db"

const app = createApp()

const worker = env.RUN_PAYMENT_WORKER ? startPaymentWorker() : null

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, worker: env.RUN_PAYMENT_WORKER },
    `API server running on port ${env.PORT}`
  )
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
