import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { sendSuccess } from "../../common/utils/response"
import { telecomService } from "./telecom.service"

export const validatePhone = asyncHandler(async (req: Request, res: Response) => {
  const phone = String(req.query.phone ?? "")
  const result = telecomService.validatePhone(phone)
  sendSuccess(res, {
    ...result,
    mobileEligible:
      result.valid && (result.carrier === "mtn" || result.carrier === "orange"),
  })
})

export const validatePhones = asyncHandler(async (req: Request, res: Response) => {
  const result = telecomService.validatePhones(req.body.phones)
  sendSuccess(res, result)
})
