import { and, eq } from "drizzle-orm"

import { env } from "../../config/env"
import { db } from "../../db/index"
import {
  employees,
  mobilePaymentTransactions,
  payrollTransactions,
} from "../../db/schema/index"

function mapTransaction(
  row: typeof payrollTransactions.$inferSelect,
  employee?: {
    mobileCarrier: string | null
    mobileAccountValid: boolean | null
    mobileAccountHolderName: string | null
    mobileAccountValidationError: string | null
  } | null,
  mobilePayment?: {
    provider: string | null
    externalId: string | null
    financialTransactionId: string | null
    status: string | null
  } | null
) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
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
    mobileCarrier: (employee?.mobileCarrier ?? undefined) as
      | "mtn"
      | "orange"
      | "nexttel"
      | "camtel"
      | "unknown"
      | undefined,
    mobileAccountValid: employee?.mobileAccountValid ?? undefined,
    mobileAccountHolderName: employee?.mobileAccountHolderName ?? undefined,
    mobileAccountValidationError:
      employee?.mobileAccountValidationError ?? undefined,
    paymentProvider: mobilePayment?.provider ?? undefined,
    paymentExternalId: mobilePayment?.externalId ?? undefined,
    paymentFinancialTransactionId:
      mobilePayment?.financialTransactionId ?? undefined,
    paymentProviderStatus: mobilePayment?.status ?? undefined,
    reference: row.reference,
    status: row.status as "pending" | "processing" | "completed" | "failed",
    failureReason: row.failureReason ?? undefined,
    paidAt: row.paidAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function fetchTransactions(
  companyId: string,
  projectId?: string
) {
  const where = projectId
    ? and(
        eq(payrollTransactions.companyId, companyId),
        eq(payrollTransactions.projectId, projectId)
      )
    : eq(payrollTransactions.companyId, companyId)

  const rows = await db
    .select({
      txn: payrollTransactions,
      employee: {
        mobileCarrier: employees.mobileCarrier,
        mobileAccountValid: employees.mobileAccountValid,
        mobileAccountHolderName: employees.mobileAccountHolderName,
        mobileAccountValidationError: employees.mobileAccountValidationError,
      },
      mobilePayment: {
        provider: mobilePaymentTransactions.provider,
        externalId: mobilePaymentTransactions.externalId,
        financialTransactionId: mobilePaymentTransactions.financialTransactionId,
        status: mobilePaymentTransactions.status,
      },
    })
    .from(payrollTransactions)
    .leftJoin(employees, eq(payrollTransactions.employeeId, employees.id))
    .leftJoin(
      mobilePaymentTransactions,
      eq(mobilePaymentTransactions.payrollTransactionId, payrollTransactions.id)
    )
    .where(where)

  return rows.map((row) =>
    mapTransaction(row.txn, row.employee, row.mobilePayment)
  )
}

export const transactionsService = {
  async list(companyId = env.DEFAULT_COMPANY_ID, projectId?: string) {
    return fetchTransactions(companyId, projectId)
  },

  async listByPayRun(payRunId: string, companyId = env.DEFAULT_COMPANY_ID) {
    const rows = await db
      .select({
        txn: payrollTransactions,
        employee: {
          mobileCarrier: employees.mobileCarrier,
          mobileAccountValid: employees.mobileAccountValid,
          mobileAccountHolderName: employees.mobileAccountHolderName,
          mobileAccountValidationError: employees.mobileAccountValidationError,
        },
        mobilePayment: {
          provider: mobilePaymentTransactions.provider,
          externalId: mobilePaymentTransactions.externalId,
          financialTransactionId: mobilePaymentTransactions.financialTransactionId,
          status: mobilePaymentTransactions.status,
        },
      })
      .from(payrollTransactions)
      .leftJoin(employees, eq(payrollTransactions.employeeId, employees.id))
      .leftJoin(
        mobilePaymentTransactions,
        eq(mobilePaymentTransactions.payrollTransactionId, payrollTransactions.id)
      )
      .where(
        and(
          eq(payrollTransactions.companyId, companyId),
          eq(payrollTransactions.payRunId, payRunId)
        )
      )

    return rows.map((row) =>
      mapTransaction(row.txn, row.employee, row.mobilePayment)
    )
  },
}
