import { desc, eq } from "drizzle-orm"

import { env } from "../../config/env"
import { db } from "../../db/index"
import { paymentLogs } from "../../db/schema/index"

function parseMetadata(raw: string | null) {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { raw }
  }
}

function mapPaymentLog(row: typeof paymentLogs.$inferSelect) {
  return {
    id: row.id,
    level: row.level as "debug" | "info" | "warn" | "error",
    event: row.event,
    message: row.message,
    metadata: parseMetadata(row.metadata),
    mobilePaymentTransactionId: row.mobilePaymentTransactionId ?? undefined,
    jobId: row.jobId ?? undefined,
    createdAt: row.createdAt,
  }
}

export const paymentLogsService = {
  async list(companyId = env.DEFAULT_COMPANY_ID) {
    const rows = await db
      .select()
      .from(paymentLogs)
      .where(eq(paymentLogs.companyId, companyId))
      .orderBy(desc(paymentLogs.createdAt))

    return rows.map(mapPaymentLog)
  },
}
