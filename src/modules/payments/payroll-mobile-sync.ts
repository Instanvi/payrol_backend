import { and, eq } from "drizzle-orm"

import { nowIso } from "../../common/utils/id"
import { db } from "../../db"
import { findOne } from "../../db/query"
import {
  mobilePaymentTransactions,
  payRuns,
  payrollTransactions,
} from "../../db/schema"
import type { InternalPaymentStatus } from "../mobile-payments/provider.utils"
import { mobilePaymentsService } from "../mobile-payments/mobile-payments.service"

async function reconcilePayRunStatus(payRunId: string, companyId: string) {
  const transactions = await db
    .select()
    .from(payrollTransactions)
    .where(
      and(
        eq(payrollTransactions.payRunId, payRunId),
        eq(payrollTransactions.companyId, companyId)
      )
    )

  if (transactions.length === 0) {
    return
  }

  const allTerminal = transactions.every(
    (txn) => txn.status === "completed" || txn.status === "failed"
  )
  if (!allTerminal) {
    return
  }

  const allFailed = transactions.every((txn) => txn.status === "failed")
  const nextStatus = allFailed ? "failed" : "completed"
  const now = nowIso()

  await db
    .update(payRuns)
    .set({
      status: nextStatus,
      processedAt: now,
      updatedAt: now,
    })
    .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, companyId)))
}

export async function syncLinkedPayrollTransaction(
  payrollTransactionId: string,
  status: InternalPaymentStatus,
  failureReason?: string | null
) {
  const now = nowIso()
  const payrollStatus =
    status === "successful"
      ? ("completed" as const)
      : status === "failed"
        ? ("failed" as const)
        : ("processing" as const)

  const txn = await findOne(
    db
      .select()
      .from(payrollTransactions)
      .where(eq(payrollTransactions.id, payrollTransactionId))
  )

  if (!txn) {
    return
  }

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

  await reconcilePayRunStatus(txn.payRunId, txn.companyId)
}

export async function syncPayRunProcessingTransactions(
  payRunId: string,
  companyId: string
) {
  const rows = await db
    .select()
    .from(payrollTransactions)
    .where(
      and(
        eq(payrollTransactions.payRunId, payRunId),
        eq(payrollTransactions.status, "processing")
      )
    )

  for (const payrollTxn of rows) {
    const mobileTxn = await findOne(
      db
        .select()
        .from(mobilePaymentTransactions)
        .where(eq(mobilePaymentTransactions.payrollTransactionId, payrollTxn.id))
    )

    if (!mobileTxn) {
      const now = nowIso()
      await db
        .update(payrollTransactions)
        .set({
          status: "failed",
          failureReason:
            "Payment was queued but never sent to Instanvi. The disbursement worker did not run — check Redis and retry.",
          updatedAt: now,
        })
        .where(eq(payrollTransactions.id, payrollTxn.id))
      continue
    }

    if (!mobileTxn.externalReferenceId) {
      continue
    }

    try {
      await mobilePaymentsService.syncStatus(
        mobileTxn.externalReferenceId,
        companyId
      )
    } catch {
      // Provider may be temporarily unavailable; leave as processing.
    }
  }

  await reconcilePayRunStatus(payRunId, companyId)
}
