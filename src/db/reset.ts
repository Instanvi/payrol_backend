import { pool } from "./index"

async function reset() {
  await pool.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
  `)
  console.log("PostgreSQL schema reset")
}

reset()
  .catch((error) => {
    console.error("Reset failed:", error)
    process.exit(1)
  })
  .finally(() => {
    void pool.end()
  })
