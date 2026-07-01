import type { Request, Response } from "express"

import { idempotencyService } from "../../common/idempotency/idempotency.service"
import { AppError } from "../../common/errors/AppError"
import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { getRouteParam } from "../../common/utils/route-param"
import { sendCreated, sendPaginated, sendSuccess } from "../../common/utils/response"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { transactionsService } from "../transactions/transactions.service"
import { syncPayRunProcessingTransactions } from "./payroll-mobile-sync"
import { paymentsBulkService } from "./payments-bulk.service"
import { paymentsService } from "./payments.service"

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const query = listQuerySchema.parse(req.query)
  const projectId =
    typeof req.query.projectId === "string" ? req.query.projectId : undefined
  const items = await paymentsService.list(auth.companyId, projectId)
  const result = paginateList(items, query, {
    searchKeys: ["reference", "payPeriod"],
    filter: (item, params) => !params.status || item.status === params.status,
  })
  sendPaginated(res, result)
})

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const payment = await paymentsService.getById(getRouteParam(req, "id"), auth.companyId)
  sendSuccess(res, payment)
})

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const payment = await paymentsService.create(req.body, auth.companyId, auth.userId)
  sendCreated(res, payment)
})

export const updatePaymentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const payment = await paymentsService.updateStatus(
      getRouteParam(req, "id"),
      req.body.status,
      auth.companyId
    )
    sendSuccess(res, payment)
  }
)

export const getPaymentTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const payRunId = getRouteParam(req, "id")
    await paymentsService.getById(payRunId, auth.companyId)
    await syncPayRunProcessingTransactions(payRunId, auth.companyId)
    const data = await transactionsService.listByPayRun(
      getRouteParam(req, "id"),
      auth.companyId
    )
    sendSuccess(res, { data })
  }
)

export const validateMobilePayRun = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const result = await paymentsBulkService.validateMobilePayRun(
      getRouteParam(req, "id"),
      auth.companyId
    )
    sendSuccess(res, result)
  }
)

function getIdempotencyKey(req: Request) {
  const key = req.header("Idempotency-Key")?.trim()
  if (!key) {
    throw AppError.validation(
      "Idempotency-Key header is required for bulk disbursement"
    )
  }
  return key
}

export const bulkDisbursePayRun = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const payRunId = getRouteParam(req, "id")
    const idempotencyKey = getIdempotencyKey(req)

    const idempotency = await idempotencyService.begin({
      companyId: auth.companyId,
      key: idempotencyKey,
      operation: "payroll_bulk_disburse",
      payload: { payRunId, ...req.body },
    })

    if (idempotency.replay) {
      res.status(idempotency.statusCode).json(idempotency.body)
      return
    }

    try {
      const result = await paymentsBulkService.queueBulkMobileDisburse(
        payRunId,
        auth.companyId,
        idempotencyKey,
        req.body
      )

      await idempotencyService.complete({
        companyId: auth.companyId,
        key: idempotencyKey,
        statusCode: 202,
        body: result,
      })

      res.status(202).json(result)
    } catch (error) {
      const body = {
        message:
          error instanceof AppError ? error.message : "Bulk disbursement failed",
        details: error instanceof AppError ? error.details : undefined,
      }
      await idempotencyService.fail({
        companyId: auth.companyId,
        key: idempotencyKey,
        body,
      })
      throw error
    }
  }
)
