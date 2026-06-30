import { and, eq } from "drizzle-orm"

import { env } from "../../config/env"
import { db } from "../../db/index"
import { payrollTransactions } from "../../db/schema/index"

function mapTransaction(row: typeof payrollTransactions.$inferSelect) {
  return {
    id: row.id,
    payRunId: row.payRunId,
    payRunReference: row.payRunReference,
    payPeriod: row.payPeriod,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employeeEmail: row.employeeEmail,
    grossAmount: row.grossAmount,
    deductions: row.deductions,
    amount: row.amount,
    currency: row.currency,
    employeePhone: row.employeePhone ?? undefined,
    reference: row.reference,
    status: row.status as "pending" | "processing" | "completed" | "failed",
    failureReason: row.failureReason ?? undefined,
    paidAt: row.paidAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const transactionsService = {
  async list(companyId = env.DEFAULT_COMPANY_ID) {
    const rows = await db
      .select()
      .from(payrollTransactions)
      .where(eq(payrollTransactions.companyId, companyId))

    return rows.map(mapTransaction)
  },

  async listByPayRun(payRunId: string, companyId = env.DEFAULT_COMPANY_ID) {
    const rows = await db
      .select()
      .from(payrollTransactions)
      .where(
        and(
          eq(payrollTransactions.companyId, companyId),
          eq(payrollTransactions.payRunId, payRunId)
        )
      )

    return rows.map(mapTransaction)
  },
}
