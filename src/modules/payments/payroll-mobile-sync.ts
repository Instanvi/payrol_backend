import { and, eq } from "drizzle-orm"

import { nowIso } from "../../common/utils/id"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { mobilePaymentTransactions, payrollTransactions } from "../../db/schema"
import type { InternalPaymentStatus } from "../mobile-payments/provider.utils"
import { mobilePaymentsService } from "../mobile-payments/mobile-payments.service"

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

    if (!mobileTxn?.externalReferenceId) {
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
}
