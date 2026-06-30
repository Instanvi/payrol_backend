import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { getAuth } from "../../common/utils/auth-context"
import { getRouteParam } from "../../common/utils/route-param"
import { sendCreated, sendSuccess } from "../../common/utils/response"
import { authService } from "./auth.service"

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body)
  sendSuccess(res, result)
})

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body)
  sendCreated(res, result)
})

export const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.verify2FA(req.body)
  sendSuccess(res, result)
})

export const resend2FA = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resend2FA(req.body.challengeToken)
  sendSuccess(res, result)
})

export const getInvitePreview = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await authService.getInvitePreview(getRouteParam(req, "token"))
    sendSuccess(res, result)
  }
)

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.acceptInvite(req.body)
  sendSuccess(res, result)
})

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const auth = getAuth(req)
  const session = await authService.getMe(auth.userId)
  sendSuccess(res, session)
})

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, { message: "Logged out successfully" })
})
