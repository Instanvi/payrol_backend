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
import { chargesService, calculateCharge } from "../charges/charges.service"
import { paymentsService } from "./payments.service"
import { syncPayRunProcessingTransactions } from "./payroll-mobile-sync"
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
  mobileAccountHolderName?: string | null
  platformFee?: number
  totalCharge?: number
  error?: string
}

function isMobileCarrier(
  carrier: MobilePayRunLine["carrier"]
): carrier is "mtn" | "orange" {
  return carrier === "mtn" || carrier === "orange"
}

function isDisbursableTransactionStatus(status: string) {
  return status === "pending" || status === "failed"
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
    await syncPayRunProcessingTransactions(payRunId, companyId)
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

    const charge = await chargesService.resolveForCompany(companyId)

    const lines: MobilePayRunLine[] = transactions.map((txn) => {
      const phone = phoneByEmployee.get(txn.employeeId) ?? null
      const base = {
        transactionId: txn.id,
        employeeId: txn.employeeId,
        employeeName: txn.employeeName,
        amount: txn.amount,
        currency: txn.currency,
        transactionStatus: txn.status,
      }

      if (!phone) {
        return {
          ...base,
          phone: null,
          carrier: "unknown" as const,
          valid: false,
          mobileEligible: false,
          accountChecked: true,
          mobileAccountValid: false,
          error: "Employee has no phone number on file",
        }
      }

      const parsed = detectCarrier(phone)
      const hasMobileCarrier = parsed.valid && isMobileCarrier(parsed.carrier)
      const employee = employeeById.get(txn.employeeId)
      const accountChecked = Boolean(employee?.mobileAccountValidatedAt)
      const mobileAccountValid = employee?.mobileAccountValid ?? null
      const mobileEligible =
        isDisbursableTransactionStatus(txn.status) &&
        hasMobileCarrier &&
        mobileAccountValid === true
      const platformFee = mobileEligible
        ? calculateCharge(txn.amount, charge).totalFee
        : 0

      return {
        ...base,
        phone: parsed.national || phone,
        carrier: parsed.carrier,
        valid: parsed.valid,
        mobileEligible,
        accountChecked,
        mobileAccountValid,
        mobileAccountHolderName: employee?.mobileAccountHolderName ?? null,
        platformFee,
        totalCharge: mobileEligible ? txn.amount + platformFee : undefined,
        error:
          txn.status === "failed"
            ? (txn.failureReason ??
              "Previous disbursement failed — you can retry")
            : !parsed.valid
              ? parsed.error
              : !hasMobileCarrier
                ? `Carrier ${parsed.carrier} is not supported for mobile money`
                : !accountChecked
                  ? "Validate mobile account before disbursement"
                  : mobileAccountValid === false
                    ? (employee?.mobileAccountValidationError ??
                      "Mobile money account is not active")
                    : txn.status === "processing"
                      ? "Disbursement in progress"
                      : txn.status === "completed"
                        ? "Already paid"
                        : undefined,
      }
    })

    const summary = {
      total: lines.length,
      pending: transactions.filter((t) => t.status === "pending").length,
      processing: transactions.filter((t) => t.status === "processing").length,
      failed: transactions.filter((t) => t.status === "failed").length,
      completed: transactions.filter((t) => t.status === "completed").length,
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
      totalPlatformFees: lines
        .filter((l) => l.mobileEligible)
        .reduce((sum, l) => sum + (l.platformFee ?? 0), 0),
      totalWithFees: lines
        .filter((l) => l.mobileEligible)
        .reduce((sum, l) => sum + l.amount + (l.platformFee ?? 0), 0),
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

    const disburseCurrency =
      options?.currency ?? payRun.currency ?? eligible[0]?.currency ?? "XAF"
    const charge = await chargesService.resolveForCompany(companyId)

    const lineFees = eligible.map((line) => ({
      line,
      fee: calculateCharge(line.amount, charge).totalFee,
    }))

    const totalAmount = lineFees.reduce((sum, item) => sum + item.line.amount, 0)
    const totalPlatformFees = lineFees.reduce((sum, item) => sum + item.fee, 0)
    const totalCharge = totalAmount + totalPlatformFees

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
          externalId: `${line.transactionId}:${idempotencyKey}`,
          payerMessage: `Payroll ${payRun.reference}`,
          payeeNote: payRun.payPeriod,
          payrollTransactionId: line.transactionId,
        },
      }
    })

    let queuedJobs: Array<{ idempotencyKey: string; jobId: string }> = []

    const result = await mobilePaymentsService.queueBulkDisburse(
      companyId,
      bulkItems,
      { payRunId }
    )
    queuedJobs = result.queued

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
        totalCharge,
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
        .set({
          status: "processing",
          failureReason: null,
          paidAt: null,
          updatedAt: now,
        })
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
      totalCharge,
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
