import type { Request } from "express"

import { eq } from "drizzle-orm"

import { paymentLogService } from "../../common/logging/payment-log.service"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { mobilePaymentTransactions } from "../../db/schema"
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
