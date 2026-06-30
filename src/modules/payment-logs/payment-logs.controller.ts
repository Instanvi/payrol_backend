import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { sendPaginated } from "../../common/utils/response"
import { paymentLogsService } from "./payment-logs.service"

export const listPaymentLogs = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const query = listQuerySchema.parse(req.query)
  const items = await paymentLogsService.list(auth.companyId)

  const result = paginateList(items, query, {
    searchKeys: ["event", "message", "jobId", "mobilePaymentTransactionId"],
    filter: (item, params) => {
      if (params.level && item.level !== params.level) return false
      return true
    },
  })

  sendPaginated(res, result)
})
