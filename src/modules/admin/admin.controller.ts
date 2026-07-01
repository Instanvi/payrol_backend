import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { getRouteParam } from "../../common/utils/route-param"
import { sendCreated, sendSuccess } from "../../common/utils/response"
import { companiesService } from "../companies/companies.service"
import { chargesService } from "../charges/charges.service"
import { getAuth } from "../../common/utils/auth-context"

export const listCompanies = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as
    | "draft"
    | "pending_review"
    | "approved"
    | "rejected"
    | "suspended"
    | undefined
  const companies = await companiesService.listForAdmin(status)
  sendSuccess(res, { data: companies })
})

export const getCompanyDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const detail = await companiesService.getAdminDetail(
      getRouteParam(req, "id")
    )
    sendSuccess(res, detail)
  }
)

export const approveCompany = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = getAuth(req)
    const detail = await companiesService.approve(
      getRouteParam(req, "id"),
      auth.userId,
      req.body.chargeId,
      req.body.forceApprove
    )
    sendSuccess(res, detail)
  }
)

export const rejectCompany = asyncHandler(async (req: Request, res: Response) => {
  const auth = getAuth(req)
  const detail = await companiesService.reject(
    getRouteParam(req, "id"),
    auth.userId,
    req.body.reason
  )
  sendSuccess(res, detail)
})

export const listCharges = asyncHandler(async (_req: Request, res: Response) => {
  const charges = await chargesService.list()
  sendSuccess(res, { data: charges })
})

export const createCharge = asyncHandler(async (req: Request, res: Response) => {
  const charge = await chargesService.create(req.body)
  sendCreated(res, charge)
})

export const assignCompanyCharge = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = getAuth(req)
    const charge = await chargesService.assignToCompany(
      getRouteParam(req, "id"),
      req.body.chargeId
    )

    await companiesService.getAdminDetail(getRouteParam(req, "id"))

    sendSuccess(res, {
      companyId: getRouteParam(req, "id"),
      charge,
      assignedBy: auth.userId,
    })
  }
)

export const previewCompanyCharge = asyncHandler(
  async (req: Request, res: Response) => {
    const amount = Number(req.query.amount ?? 0)
    const breakdown = await chargesService.calculateForCompany(
      getRouteParam(req, "id"),
      amount
    )
    sendSuccess(res, breakdown)
  }
)

export const getAdminStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const pending = await companiesService.listForAdmin("pending_review")
    sendSuccess(res, { pendingReviews: pending.length })
  }
)
