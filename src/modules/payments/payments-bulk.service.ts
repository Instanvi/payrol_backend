import { and, eq, inArray } from "drizzle-orm"

import { paymentLogService } from "../../common/logging/payment-log.service"
import { AppError } from "../../common/errors/AppError"
import { detectCarrier } from "../../common/utils/phone-carrier"
import { nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db"
import { employees, payRuns, payrollTransactions } from "../../db/schema"
import { mobilePaymentsService } from "../mobile-payments/mobile-payments.service"
import type { BulkDisburseItem } from "../mobile-payments/mobile-payments.types"
import { carrierToProvider } from "../mobile-payments/provider.utils"
import { walletsService } from "../wallets/wallets.service"
import { chargesService, calculateCharge } from "../charges/charges.service"
import { paymentsService } from "./payments.service"
import { transactionsService } from "../transactions/transactions.service"
import type { BulkDisburseInput } from "./payments.validation"

export interface MobilePayRunLine {
  transactionId: string
  employeeId: string
  employeeName: string
  amount: number
  currency: string
  transactionStatus: string
  phone: string | null
  carrier: ReturnType<typeof detectCarrier>["carrier"]
  valid: boolean
  mobileEligible: boolean
  accountChecked: boolean
  mobileAccountValid: boolean | null
  error?: string
}

function isMobileCarrier(
  carrier: MobilePayRunLine["carrier"]
): carrier is "mtn" | "orange" {
  return carrier === "mtn" || carrier === "orange"
}

function filterLinesBySelection(
  lines: MobilePayRunLine[],
  options?: Pick<BulkDisburseInput, "employeeIds" | "transactionIds">
) {
  if (options?.transactionIds?.length) {
    const selected = new Set(options.transactionIds)
    return lines.filter((line) => selected.has(line.transactionId))
  }

  if (options?.employeeIds?.length) {
    const selected = new Set(options.employeeIds)
    return lines.filter((line) => selected.has(line.employeeId))
  }

  return lines
}

export const paymentsBulkService = {
  async validateMobilePayRun(payRunId: string, companyId = env.DEFAULT_COMPANY_ID) {
    const payRun = await paymentsService.getById(payRunId, companyId)
    const transactions = await transactionsService.listByPayRun(payRunId, companyId)

    if (transactions.length === 0) {
      throw AppError.validation("Pay run has no payroll transactions")
    }

    const employeeIds = [...new Set(transactions.map((t) => t.employeeId))]
    const employeeRows = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.companyId, companyId),
          inArray(employees.id, employeeIds)
        )
      )

    const phoneByEmployee = new Map(
      employeeRows.map((row) => [row.id, row.phone ?? null])
    )
    const employeeById = new Map(employeeRows.map((row) => [row.id, row]))

    const lines: MobilePayRunLine[] = transactions.map((txn) => {
      const phone = phoneByEmployee.get(txn.employeeId) ?? null
      const employee = employeeById.get(txn.employeeId)
      const base = {
        transactionId: txn.id,
        employeeId: txn.employeeId,
        employeeName: txn.employeeName,
        amount: txn.amount,
        currency: txn.currency,
        transactionStatus: txn.status,
        accountChecked: employee?.mobileAccountValid != null,
        mobileAccountValid: employee?.mobileAccountValid ?? null,
      }

      if (!phone) {
        return {
          ...base,
          phone: null,
          carrier: "unknown" as const,
          valid: false,
          mobileEligible: false,
          error: "Employee has no phone number on file",
        }
      }

      const carrier =
        (employee?.mobileCarrier as MobilePayRunLine["carrier"] | null) ??
        detectCarrier(phone).carrier
      const parsed = detectCarrier(phone)
      const storedValid = employee?.mobileAccountValid === true
      const storedInvalid = employee?.mobileAccountValid === false

      if (storedInvalid) {
        return {
          ...base,
          phone: parsed.national || phone,
          carrier,
          valid: parsed.valid,
          mobileEligible: false,
          error:
            employee?.mobileAccountValidationError ??
            "Employee mobile account is not valid",
        }
      }

      const prefixEligible =
        parsed.valid &&
        isMobileCarrier(parsed.carrier) &&
        txn.status === "pending"
      const mobileEligible =
        txn.status === "pending" &&
        (storedValid || prefixEligible) &&
        isMobileCarrier(carrier)

      return {
        ...base,
        phone: parsed.national || phone,
        carrier,
        valid: parsed.valid,
        mobileEligible,
        error:
          !storedValid && !prefixEligible && employee?.mobileAccountValid == null
            ? "Employee account not validated — run validate-account first"
            : parsed.error,
      }
    })

    const summary = {
      total: lines.length,
      pending: transactions.filter((t) => t.status === "pending").length,
      mtn: lines.filter((l) => l.carrier === "mtn").length,
      orange: lines.filter((l) => l.carrier === "orange").length,
      other: lines.filter(
        (l) => l.valid && l.carrier !== "mtn" && l.carrier !== "orange"
      ).length,
      invalid: lines.filter((l) => !l.valid || !l.phone).length,
      unchecked: lines.filter((l) => !l.accountChecked).length,
      accountValid: lines.filter((l) => l.mobileAccountValid === true).length,
      mobileEligible: lines.filter((l) => l.mobileEligible).length,
      totalMobileAmount: lines
        .filter((l) => l.mobileEligible)
        .reduce((sum, l) => sum + l.amount, 0),
    }

    return {
      payRunId: payRun.id,
      reference: payRun.reference,
      payPeriod: payRun.payPeriod,
      status: payRun.status,
      summary,
      lines,
    }
  },

  async queueBulkMobileDisburse(
    payRunId: string,
    companyId: string,
    idempotencyKey: string,
    options?: BulkDisburseInput
  ) {
    const validation = await this.validateMobilePayRun(payRunId, companyId)
    const payRun = await paymentsService.getById(payRunId, companyId)

    if (payRun.status === "completed") {
      throw AppError.validation("Pay run is already completed")
    }

    const selectedLines = filterLinesBySelection(validation.lines, options)
    const eligible = selectedLines.filter((line) => line.mobileEligible)
    const ineligibleSelected = selectedLines.filter((line) => !line.mobileEligible)

    if (selectedLines.length === 0) {
      throw AppError.validation(
        "No employees selected for disbursement. Provide employeeIds or transactionIds.",
        { validation }
      )
    }

    if (ineligibleSelected.length > 0) {
      throw AppError.validation(
        `${ineligibleSelected.length} selected employee(s) are not eligible for mobile money disbursement`,
        {
          ineligible: ineligibleSelected.map((line) => ({
            employeeId: line.employeeId,
            employeeName: line.employeeName,
            transactionId: line.transactionId,
            reason: line.error ?? "Not mobile-money eligible",
          })),
        }
      )
    }

    if (eligible.length === 0) {
      throw AppError.validation(
        "No mobile-money-eligible employees to disburse. Validate phone numbers first.",
        { validation }
      )
    }

    const wallet = await walletsService.getByCompanyId(companyId)
    const disburseCurrency = options?.currency ?? wallet.currency
    const charge = await chargesService.resolveForCompany(companyId)

    const lineFees = eligible.map((line) => ({
      line,
      fee: calculateCharge(line.amount, charge).totalFee,
    }))

    const totalAmount = lineFees.reduce((sum, item) => sum + item.line.amount, 0)
    const totalPlatformFees = lineFees.reduce((sum, item) => sum + item.fee, 0)
    const totalDebit = totalAmount + totalPlatformFees

    if (wallet.balance < totalDebit) {
      throw AppError.validation(
        `Insufficient wallet balance. Need ${totalDebit} ${disburseCurrency} (payroll ${totalAmount} + platform fees ${totalPlatformFees}), available ${wallet.balance} ${wallet.currency}`
      )
    }

    await walletsService.debit(
      wallet.id,
      totalDebit,
      `Bulk payroll ${payRun.reference} including platform fees`
    )

    const bulkItems: BulkDisburseItem[] = lineFees.map(({ line }) => {
      const provider = isMobileCarrier(line.carrier)
        ? carrierToProvider(line.carrier)
        : undefined

      return {
        idempotencyKey: `${idempotencyKey}:${line.transactionId}`,
        input: {
          amount: line.amount,
          currency: disburseCurrency,
          phone: line.phone!,
          provider: provider ?? undefined,
          externalId: line.transactionId,
          payerMessage: `Payroll ${payRun.reference}`,
          payeeNote: payRun.payPeriod,
          payrollTransactionId: line.transactionId,
        },
      }
    })

    let queuedJobs: Array<{ idempotencyKey: string; jobId: string }> = []

    try {
      const result = await mobilePaymentsService.queueBulkDisburse(
        companyId,
        bulkItems,
        { payRunId }
      )
      queuedJobs = result.queued
    } catch (error) {
      await walletsService.credit(
        wallet.id,
        totalDebit,
        `Bulk payroll ${payRun.reference} reversal — queue failed`
      )
      throw error
    }

    const queuedByKey = new Map(
      queuedJobs.map((job) => [job.idempotencyKey, job.jobId])
    )

    const now = nowIso()

    await db
      .update(payRuns)
      .set({
        platformFeeAmount: totalPlatformFees,
        platformChargeId: charge.id,
        status: "pending",
        updatedAt: now,
      })
      .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))

    await paymentLogService.info({
      companyId,
      event: "payroll.bulk.started",
      message: `Bulk mobile payroll disbursement for pay run ${payRun.reference}`,
      metadata: {
        payRunId,
        idempotencyKey,
        selected: selectedLines.length,
        eligible: eligible.length,
        skipped: validation.lines.length - eligible.length,
        totalAmount,
        totalPlatformFees,
        totalDebit,
        employeeIds: options?.employeeIds,
        transactionIds: options?.transactionIds,
      },
    })

    const queued: Array<{
      transactionId: string
      employeeName: string
      jobId: string
      amount: number
    }> = []

    for (const { line, fee } of lineFees) {
      const txnKey = `${idempotencyKey}:${line.transactionId}`

      await paymentLogService.info({
        companyId,
        event: "payroll.platform_fee",
        message: `Platform fee charged for ${line.employeeName}`,
        metadata: {
          transactionId: line.transactionId,
          employeeName: line.employeeName,
          disburseAmount: line.amount,
          platformFee: fee,
          chargeId: charge.id,
        },
      })

      await db
        .update(payrollTransactions)
        .set({ status: "processing", updatedAt: now })
        .where(eq(payrollTransactions.id, line.transactionId))

      queued.push({
        transactionId: line.transactionId,
        employeeName: line.employeeName,
        jobId: queuedByKey.get(txnKey) ?? txnKey,
        amount: line.amount,
      })
    }

    const skipped = validation.lines
      .filter((l) => !eligible.some((e) => e.transactionId === l.transactionId))
      .map((l) => ({
        transactionId: l.transactionId,
        employeeName: l.employeeName,
        reason: l.error ?? "Not eligible for mobile money disbursement",
      }))

    await paymentLogService.info({
      companyId,
      event: "payroll.bulk.queued",
      message: `Queued ${queued.length} mobile disbursement jobs`,
      metadata: { payRunId, queued: queued.length, skipped: skipped.length },
    })

    return {
      status: "queued" as const,
      payRunId,
      idempotencyKey,
      currency: disburseCurrency,
      totalAmount,
      totalPlatformFees,
      totalDebit,
      queuedCount: queued.length,
      skippedCount: skipped.length,
      selectedCount: selectedLines.length,
      queued,
      skipped,
      validation: {
        mtn: validation.summary.mtn,
        orange: validation.summary.orange,
        invalid: validation.summary.invalid,
      },
    }
  },
}
