import { logger } from "./common/logger"
import { pool } from "./db"
import { verifyRedisConnection } from "./queues/payment.queue"
import { startPaymentWorker } from "./queues/payment.worker"

async function main() {
  await verifyRedisConnection()
  logger.info("Redis connected — starting payment worker")
  const worker = startPaymentWorker()

  async function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down payment worker")
    await worker.close()
    await pool.end()
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
}

main().catch((err) => {
  logger.error({ err }, "Payment worker failed to start")
  process.exit(1)
})
