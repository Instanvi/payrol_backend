import path from "node:path"
import { fileURLToPath } from "node:url"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { logger } from "../common/logger"
import { pool } from "./index"

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle"
)

async function runMigrations() {
  const db = drizzle(pool)

  logger.info({ migrationsFolder }, "Running database migrations")
  await migrate(db, { migrationsFolder })
  logger.info("Database migrations complete")
}

runMigrations()
  .catch((error) => {
    logger.error({ err: error }, "Database migration failed")
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
