import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { sendPaginated } from "../../common/utils/response"
import { transactionsService } from "./transactions.service"

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const query = listQuerySchema.parse(req.query)
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined
  const items = await transactionsService.list(auth.companyId, projectId)
  const result = paginateList(items, query, {
    searchKeys: [
      "employeeName",
      "employeeEmail",
      "reference",
      "payRunReference",
      "payPeriod",
    ],
    filter: (item, params) => {
      if (params.status && item.status !== params.status) return false
      if (params.payRunId && item.payRunId !== params.payRunId) return false
      return true
    },
  })
  sendPaginated(res, result)
})
