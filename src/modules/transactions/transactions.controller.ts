import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { sendPaginated } from "../../common/utils/response"
import { transactionsService } from "./transactions.service"
import { syncCompanyProcessingTransactions } from "../payments/payroll-mobile-sync"

function matchesMobileAccountStatus(
  valid: boolean | null | undefined,
  filter?: "valid" | "invalid" | "unchecked"
) {
  if (!filter) return true
  if (filter === "valid") return valid === true
  if (filter === "invalid") return valid === false
  return valid === null || valid === undefined
}

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const query = listQuerySchema.parse(req.query)
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined
  await syncCompanyProcessingTransactions(auth.companyId)
  const items = await transactionsService.list(auth.companyId, projectId)
  const result = paginateList(items, query, {
    searchKeys: [
      "employeeName",
      "employeeEmail",
      "employeePhone",
      "mobileAccountHolderName",
      "reference",
      "payRunReference",
      "payPeriod",
      "failureReason",
      "paymentExternalId",
      "paymentFinancialTransactionId",
    ],
    filter: (item, params) => {
      if (params.status && item.status !== params.status) return false
      if (params.payRunId && item.payRunId !== params.payRunId) return false
      if (
        params.carrier &&
        (item.mobileCarrier ?? "unknown") !== params.carrier
      ) {
        return false
      }
      if (
        !matchesMobileAccountStatus(
          item.mobileAccountValid,
          params.mobileAccountStatus
        )
      ) {
        return false
      }
      return true
    },
  })
  sendPaginated(res, result)
})
