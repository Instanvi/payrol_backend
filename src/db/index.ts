import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"

import { env } from "../config/env"
import * as schema from "./schema/index"

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: process.env.VERCEL ? 5_000 : 30_000,
})

export const db = drizzle(pool, { schema })
export { pool }
