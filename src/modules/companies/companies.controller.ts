import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { getRouteParam } from "../../common/utils/route-param"
import { sendCreated, sendSuccess } from "../../common/utils/response"
import { walletsService } from "../wallets/wallets.service"
import { companiesService } from "./companies.service"

export const getMyCompany = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const company = await companiesService.getById(auth.companyId)
  sendSuccess(res, company)
})

export const updateMyCompany = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const company = await companiesService.updateProfile(
      auth.companyId,
      req.body
    )
    sendSuccess(res, company)
  }
)

export const getOnboardingStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const status = await companiesService.getOnboardingStatus(auth.companyId)
    sendSuccess(res, status)
  }
)

export const uploadKycDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const doc = await companiesService.uploadKycDocument(
      auth.companyId,
      auth.userId,
      req.body
    )
    sendCreated(res, doc)
  }
)

export const submitKyc = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const status = await companiesService.submitKyc(auth.companyId, auth.userId)
  sendSuccess(res, status)
})

export const listKycDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const docs = await companiesService.listKycDocuments(auth.companyId)
    sendSuccess(res, docs)
  }
)

export const getCompanyWallet = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const wallet = await walletsService.getByCompanyId(auth.companyId)
    sendSuccess(res, wallet)
  }
)
