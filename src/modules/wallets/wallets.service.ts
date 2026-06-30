import { eq } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import { wallets } from "../../db/schema/index"

function mapWallet(row: typeof wallets.$inferSelect) {
  return {
    id: row.id,
    companyId: row.companyId,
    balance: row.balance,
    currency: row.currency,
    momoAccountId: row.momoAccountId ?? undefined,
    status: row.status as "active" | "suspended",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const walletsService = {
  async createForCompany(
    companyId: string,
    options?: { currency?: string; initialBalance?: number; momoAccountId?: string }
  ) {
    const existing = await findOne(
      db.select().from(wallets).where(eq(wallets.companyId, companyId))
    )

    if (existing) {
      return mapWallet(existing)
    }

    const now = nowIso()
    const row = {
      id: createId(),
      companyId,
      balance: options?.initialBalance ?? 0,
      currency: options?.currency ?? "XAF",
      momoAccountId: options?.momoAccountId ?? null,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(wallets).values(row)
    return mapWallet(row)
  },

  async getByCompanyId(companyId: string) {
    const row = await findOne(
      db.select().from(wallets).where(eq(wallets.companyId, companyId))
    )

    if (!row) {
      throw AppError.notFound(
        "Wallet not found for this company. Contact support."
      )
    }

    return mapWallet(row)
  },

  async credit(walletId: string, amount: number, _reason?: string) {
    const row = await findOne(
      db.select().from(wallets).where(eq(wallets.id, walletId))
    )

    if (!row) throw AppError.notFound("Wallet not found")
    if (row.status !== "active") {
      throw AppError.validation("Wallet is suspended")
    }

    const balance = row.balance + amount
    const now = nowIso()

    await db
      .update(wallets)
      .set({ balance, updatedAt: now })
      .where(eq(wallets.id, walletId))

    return { ...mapWallet(row), balance }
  },

  async debit(walletId: string, amount: number, _reason?: string) {
    const row = await findOne(
      db.select().from(wallets).where(eq(wallets.id, walletId))
    )

    if (!row) throw AppError.notFound("Wallet not found")
    if (row.status !== "active") {
      throw AppError.validation("Wallet is suspended")
    }
    if (row.balance < amount) {
      throw AppError.validation("Insufficient wallet balance")
    }

    const balance = row.balance - amount
    const now = nowIso()

    await db
      .update(wallets)
      .set({ balance, updatedAt: now })
      .where(eq(wallets.id, walletId))

    return { ...mapWallet(row), balance }
  },
}
