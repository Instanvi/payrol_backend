import { and, eq } from "drizzle-orm"

import { env } from "../config/env"
import { hashPassword } from "../common/utils/password"
import { db, pool } from "./index"
import { findOne } from "./query"
import { charges, users } from "./schema/index"

async function seedDefaultCharge() {
  const existingCharge = await findOne(
    db.select().from(charges).where(eq(charges.isDefault, true))
  )

  if (existingCharge) {
    console.log("Default charge already exists — skipping")
    return
  }

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

  console.log("Created default charge")
}

async function seedSystemAdmin() {
  const adminEmail = env.SEED_ADMIN_EMAIL.toLowerCase()
  const passwordHash = await hashPassword(
    env.SEED_ADMIN_PASSWORD ?? env.DEMO_PASSWORD
  )

  const existingUser = await findOne(
    db.select().from(users).where(eq(users.email, adminEmail))
  )

  if (existingUser) {
    await db
      .update(users)
      .set({
        companyId: null,
        name: existingUser.name || "Platform Admin",
        passwordHash,
        role: "owner",
        status: "active",
        isSystemAdmin: true,
      })
      .where(eq(users.email, adminEmail))

    console.log(`Updated system admin: ${adminEmail}`)
    return
  }

  await db.insert(users).values({
    companyId: null,
    name: "Platform Admin",
    email: adminEmail,
    passwordHash,
    avatar: null,
    phone: null,
    role: "owner",
    status: "active",
    isSystemAdmin: true,
    lastLoginAt: null,
  })

  console.log(`Created system admin: ${adminEmail}`)
}

async function seed() {
  await seedDefaultCharge()
  await seedSystemAdmin()

  console.log("System seed completed")
  console.log(`  Admin login: ${env.SEED_ADMIN_EMAIL.toLowerCase()}`)
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
