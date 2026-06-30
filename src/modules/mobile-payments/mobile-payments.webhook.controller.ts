import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { mobilePaymentsWebhookService } from "./mobile-payments.webhook.service"

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await mobilePaymentsWebhookService.process(req)
  res.status(200).json(result)
})
