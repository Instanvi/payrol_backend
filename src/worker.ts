import { logger } from "./common/logger"
import { pool } from "./db"
import { startPaymentWorker } from "./queues/payment.worker"

const worker = startPaymentWorker()

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down payment worker")
  await worker.close()
  await pool.end()
  process.exit(0)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))
