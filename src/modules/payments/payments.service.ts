import { and, eq } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import {
  amountsFromSalaries,
  computeDeductions,
  computeNetPay,
  mapPayRunStatusToTransactionStatus,
} from "../../common/utils/payroll"
import { env } from "../../config/env"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import {
  payRunEmployees,
  payRuns,
  payrollTransactions,
} from "../../db/schema/index"
import { employeesService } from "../employees/employees.service"
import { chargesService } from "../charges/charges.service"
import type { CreatePaymentInput } from "./payments.validation"

type PayRunStatus = "draft" | "pending" | "completed" | "failed"

function mapPayRun(
  row: typeof payRuns.$inferSelect,
  employeeIds: string[]
) {
  return {
    id: row.id,
    reference: row.reference,
    payPeriod: row.payPeriod,
    description: row.description ?? undefined,
    amount: row.amount,
    currency: row.currency,
    employeeCount: employeeIds.length,
    employeeIds,
    status: row.status as PayRunStatus,
    scheduledAt: row.scheduledAt ?? undefined,
    processedAt: row.processedAt ?? undefined,
    platformFeeAmount: row.platformFeeAmount,
    platformChargeId: row.platformChargeId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function getEmployeeIds(payRunId: string) {
  const rows = await db
    .select({ employeeId: payRunEmployees.employeeId })
    .from(payRunEmployees)
    .where(eq(payRunEmployees.payRunId, payRunId))

  return rows.map((row) => row.employeeId)
}

async function createTransactionsForPayRun(
  payRunId: string,
  companyId: string,
  input: {
    reference: string
    payPeriod: string
    currency: string
    amount: number
    status: PayRunStatus
    createdAt: string
  },
  selectedEmployees: Awaited<
    ReturnType<typeof employeesService.getActiveByIds>
  >
) {
  const grossAmounts = amountsFromSalaries(selectedEmployees, input.amount)
  const txnStatus = mapPayRunStatusToTransactionStatus(input.status)
  const paidAt = input.status === "completed" ? input.createdAt : null
  const now = input.createdAt

  for (const [index, employee] of selectedEmployees.entries()) {
    const gross = grossAmounts[index] ?? 0
    const deductions = computeDeductions(gross)
    const net = computeNetPay(gross, deductions)

    await db.insert(payrollTransactions).values({
      id: createId(),
      companyId,
      payRunId,
      payRunReference: input.reference,
      payPeriod: input.payPeriod,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      grossAmount: gross,
      deductions,
      amount: net,
      currency: input.currency,
      employeePhone: employee.phone ?? null,
      reference: `${input.reference}-${String(index + 1).padStart(3, "0")}`,
      status: txnStatus,
      failureReason:
        input.status === "failed" ? "Mobile money disbursement failed" : null,
      paidAt,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export const paymentsService = {
  async list(companyId = env.DEFAULT_COMPANY_ID) {
    const rows = await db
      .select()
      .from(payRuns)
      .where(eq(payRuns.companyId, companyId))

    return Promise.all(
      rows.map(async (row) => mapPayRun(row, await getEmployeeIds(row.id)))
    )
  },

  async getById(id: string, companyId = env.DEFAULT_COMPANY_ID) {
    const row = await findOne(
      db
        .select()
        .from(payRuns)
        .where(and(eq(payRuns.id, id), eq(payRuns.companyId, companyId)))
    )

    if (!row) throw AppError.notFound("Payment not found")
    return mapPayRun(row, await getEmployeeIds(row.id))
  },

  async create(
    input: CreatePaymentInput,
    companyId = env.DEFAULT_COMPANY_ID,
    createdBy?: string
  ) {
    const selectedEmployees = await employeesService.getActiveByIds(
      input.employeeIds,
      companyId
    )

    if (selectedEmployees.length !== input.employeeIds.length) {
      throw AppError.validation("One or more selected employees are invalid")
    }

    const feeBreakdown = await chargesService.calculateForCompany(
      companyId,
      input.amount
    )

    const payRunId = createId()
    const createdAt = nowIso()
    const status: PayRunStatus = "pending"

    await db.insert(payRuns).values({
      id: payRunId,
      companyId,
      reference: input.reference,
      payPeriod: input.payPeriod,
      description: input.description ?? null,
      amount: input.amount,
      currency: input.currency,
      status,
      scheduledAt: input.scheduledAt ?? null,
      processedAt: null,
      createdBy: createdBy ?? null,
      platformFeeAmount: feeBreakdown.totalFee,
      platformChargeId: feeBreakdown.chargeId,
      createdAt,
      updatedAt: createdAt,
    })

    for (const employeeId of input.employeeIds) {
      await db.insert(payRunEmployees).values({ payRunId, employeeId })
    }

    await createTransactionsForPayRun(
      payRunId,
      companyId,
      {
        reference: input.reference,
        payPeriod: input.payPeriod,
        currency: input.currency,
        amount: input.amount,
        status,
        createdAt,
      },
      selectedEmployees
    )

    return this.getById(payRunId, companyId)
  },

  async updateStatus(
    id: string,
    status: PayRunStatus,
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    const payRun = await this.getById(id, companyId)
    const now = nowIso()
    const processedAt = status === "completed" || status === "failed" ? now : null

    await db
      .update(payRuns)
      .set({ status, processedAt, updatedAt: now })
      .where(and(eq(payRuns.id, id), eq(payRuns.companyId, companyId)))

    const txnStatus = mapPayRunStatusToTransactionStatus(status)
    const paidAt = status === "completed" ? now : null

    await db
      .update(payrollTransactions)
      .set({
        status: txnStatus,
        paidAt,
        failureReason: status === "failed" ? "Bank rejected transfer" : null,
        updatedAt: now,
      })
      .where(eq(payrollTransactions.payRunId, id))

    return { ...payRun, status, processedAt: processedAt ?? undefined }
  },
}
