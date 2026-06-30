import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { sendSuccess } from "../../common/utils/response"
import { dashboardService } from "./dashboard.service"

export const getDashboardStats = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const stats = await dashboardService.getStats(auth.companyId)
    sendSuccess(res, stats)
  }
)
