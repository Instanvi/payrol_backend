import { eq } from "drizzle-orm"

import { env } from "../../config/env"
import { db } from "../../db/index"
import { employees, payRuns, payrollTransactions } from "../../db/schema/index"

export const dashboardService = {
  async getStats(companyId = env.DEFAULT_COMPANY_ID) {
    const employeeRows = await db
      .select()
      .from(employees)
      .where(eq(employees.companyId, companyId))

    const payRunRows = await db
      .select()
      .from(payRuns)
      .where(eq(payRuns.companyId, companyId))

    const transactionRows = await db
      .select()
      .from(payrollTransactions)
      .where(eq(payrollTransactions.companyId, companyId))

    return {
      employees: employeeRows.length,
      activeEmployees: employeeRows.filter((row) => row.status === "active")
        .length,
      pendingPayRuns: payRunRows.filter((row) => row.status === "pending")
        .length,
      totalPayRuns: payRunRows.length,
      totalTransactions: transactionRows.length,
      pendingTransactions: transactionRows.filter(
        (row) => row.status === "pending" || row.status === "processing"
      ).length,
    }
  },
}
