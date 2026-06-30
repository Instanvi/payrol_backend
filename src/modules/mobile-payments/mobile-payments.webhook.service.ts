import { eq } from "drizzle-orm"
import type { Request } from "express"

import { paymentLogService } from "../../common/logging/payment-log.service"
import { nowIso } from "../../common/utils/id"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { mobilePaymentTransactions, payrollTransactions } from "../../db/schema"
import { mobilePaymentsService } from "./mobile-payments.service"

function extractTransactionId(req: Request): string | null {
  const body = req.body as Record<string, unknown> | undefined
  if (!body) return null

  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body

  const candidates = [
    data.transaction_id,
    data.transactionId,
    body.transaction_id,
    body.transactionId,
    data.reference_id,
    data.referenceId,
    data.id,
  ]

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return null
}

async function syncLinkedPayrollTransaction(
  payrollTransactionId: string,
  status: "successful" | "failed" | "pending",
  failureReason?: string | null
) {
  const now = nowIso()
  const payrollStatus =
    status === "successful"
      ? ("completed" as const)
      : status === "failed"
        ? ("failed" as const)
        : ("processing" as const)

  await db
    .update(payrollTransactions)
    .set({
      status: payrollStatus,
      paidAt: status === "successful" ? now : null,
      failureReason:
        status === "failed"
          ? (failureReason ?? "Mobile money disbursement failed")
          : null,
      updatedAt: now,
    })
    .where(eq(payrollTransactions.id, payrollTransactionId))
}

export const mobilePaymentsWebhookService = {
  async process(req: Request) {
    const transactionId = extractTransactionId(req)

    await paymentLogService.info({
      event: "mobile_payments.webhook.received",
      message: "Instanvi payment webhook received",
      metadata: {
        transactionId,
        event:
          typeof req.body === "object" && req.body && "event" in req.body
            ? String((req.body as { event?: string }).event)
            : undefined,
        method: req.method,
      },
    })

    if (!transactionId) {
      await paymentLogService.warn({
        event: "mobile_payments.webhook.missing_reference",
        message: "Payment webhook missing transaction_id",
      })
      return {
        acknowledged: true,
        processed: false,
        reason: "missing_transaction_id",
      }
    }

    const txn = await findOne(
      db
        .select()
        .from(mobilePaymentTransactions)
        .where(eq(mobilePaymentTransactions.externalReferenceId, transactionId))
    )

    if (!txn) {
      await paymentLogService.warn({
        event: "mobile_payments.webhook.unknown_reference",
        message: "Payment webhook for unknown transaction",
        metadata: { transactionId },
      })
      return {
        acknowledged: true,
        processed: false,
        reason: "unknown_transaction",
      }
    }

    const result = await mobilePaymentsService.syncStatus(
      transactionId,
      txn.companyId
    )

    if (txn.payrollTransactionId) {
      await syncLinkedPayrollTransaction(
        txn.payrollTransactionId,
        result.status,
        result.failureReason
      )
    }

    await paymentLogService.info({
      companyId: txn.companyId,
      event: "mobile_payments.webhook.processed",
      message: "Payment webhook processed and status synced",
      mobilePaymentTransactionId: txn.id,
      metadata: {
        transactionId,
        status: result.status,
        providerStatus: result.providerStatus,
        payrollTransactionId: txn.payrollTransactionId,
      },
    })

    return {
      acknowledged: true,
      processed: true,
      transactionId,
      status: result.status,
      providerStatus: result.providerStatus,
    }
  },
}
