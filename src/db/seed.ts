import { and, eq } from "drizzle-orm"

import { env } from "../config/env"
import { hashPassword } from "../common/utils/password"
import { db, pool } from "./index"
import { findOne } from "./query"
import { charges, users } from "./schema/index"

async function seed() {
  const existingAdmin = await findOne(
    db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, env.SEED_ADMIN_EMAIL.toLowerCase()),
          eq(users.isSystemAdmin, true)
        )
      )
  )

  if (existingAdmin) {
    console.log("System seed already applied — skipping")
    console.log("Run `npm run db:reset` to wipe and re-seed")
    return
  }

  const passwordHash = await hashPassword(env.DEMO_PASSWORD)

  await db.insert(charges).values({
    name: "Standard",
    description: "Default platform transaction charge",
    isDefault: true,
    fixedFee: 50,
    percentFee: 1.5,
    minFee: 50,
    maxFee: 5000,
    currency: "XAF",
    active: true,
  })

  await db.insert(users).values({
    companyId: null,
    name: "Platform Admin",
    email: env.SEED_ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    avatar: null,
    phone: null,
    role: "owner",
    status: "active",
    isSystemAdmin: true,
    lastLoginAt: null,
  })

  console.log("System seed completed")
  console.log("  1 default charge")
  console.log("  1 system admin user (no tenant company)")
  console.log(`  Admin login: ${env.SEED_ADMIN_EMAIL} / ${env.DEMO_PASSWORD}`)
  console.log("  OTP codes are emailed via Resend (or logged in dev console)")
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
  .finally(() => {
    void pool.end()
  })
