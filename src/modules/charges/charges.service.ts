import { and, eq } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { charges, companies } from "../../db/schema"

export type ChargeRow = typeof charges.$inferSelect

export interface ChargeBreakdown {
  chargeId: string
  chargeName: string
  currency: string
  transactionAmount: number
  fixedFee: number
  percentFee: number
  percentAmount: number
  totalFee: number
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function calculateCharge(amount: number, charge: ChargeRow): ChargeBreakdown {
  const percentAmount = roundMoney((amount * charge.percentFee) / 100)
  let totalFee = roundMoney(charge.fixedFee + percentAmount)

  if (charge.minFee != null) totalFee = Math.max(totalFee, charge.minFee)
  if (charge.maxFee != null) totalFee = Math.min(totalFee, charge.maxFee)

  return {
    chargeId: charge.id,
    chargeName: charge.name,
    currency: charge.currency,
    transactionAmount: amount,
    fixedFee: charge.fixedFee,
    percentFee: charge.percentFee,
    percentAmount,
    totalFee,
  }
}

export const chargesService = {
  async list() {
    return db.select().from(charges)
  },

  async getDefault() {
    const charge = await findOne(
      db
        .select()
        .from(charges)
        .where(and(eq(charges.isDefault, true), eq(charges.active, true)))
    )
    if (!charge) {
      throw AppError.notFound("No default charge configured")
    }
    return charge
  },

  async getById(id: string) {
    const charge = await findOne(
      db.select().from(charges).where(eq(charges.id, id))
    )
    if (!charge) throw AppError.notFound("Charge not found")
    return charge
  },

  async resolveForCompany(companyId: string) {
    const company = await findOne(
      db.select().from(companies).where(eq(companies.id, companyId))
    )
    if (!company) throw AppError.notFound("Company not found")

    if (company.chargeId) {
      const assigned = await this.getById(company.chargeId)
      if (assigned.active) return assigned
    }

    return this.getDefault()
  },

  async calculateForCompany(companyId: string, transactionAmount: number) {
    const charge = await this.resolveForCompany(companyId)
    return calculateCharge(transactionAmount, charge)
  },

  async create(input: {
    name: string
    description?: string
    isDefault?: boolean
    fixedFee: number
    percentFee: number
    minFee?: number
    maxFee?: number
    currency?: string
  }) {
    const now = nowIso()

    if (input.isDefault) {
      await db
        .update(charges)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(charges.isDefault, true))
    }

    const row = {
      id: createId(),
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      fixedFee: input.fixedFee,
      percentFee: input.percentFee,
      minFee: input.minFee ?? null,
      maxFee: input.maxFee ?? null,
      currency: input.currency ?? "XAF",
      active: true,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(charges).values(row)
    return row
  },

  async assignToCompany(companyId: string, chargeId: string) {
    await this.getById(chargeId)
    const now = nowIso()
    await db
      .update(companies)
      .set({ chargeId, updatedAt: now })
      .where(eq(companies.id, companyId))
    return this.getById(chargeId)
  },
}
