import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { getRouteParam } from "../../common/utils/route-param"
import { sendCreated, sendNoContent, sendPaginated, sendSuccess } from "../../common/utils/response"
import { employeesService } from "./employees.service"

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const query = listQuerySchema.parse(req.query)
  const items = await employeesService.list(auth.companyId)
  const result = paginateList(items, query, {
    searchKeys: ["name", "email", "department", "phone"],
    filter: (item, params) => !params.status || item.status === params.status,
  })
  sendPaginated(res, result)
})

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const employee = await employeesService.getById(
    getRouteParam(req, "id"),
    auth.companyId
  )
  sendSuccess(res, employee)
})

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const employee = await employeesService.create(req.body, auth.companyId)
  sendCreated(res, employee)
})

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const employee = await employeesService.update(
    getRouteParam(req, "id"),
    req.body,
    auth.companyId
  )
  sendSuccess(res, employee)
})

export const deactivateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  await employeesService.deactivate(getRouteParam(req, "id"), auth.companyId)
  sendNoContent(res)
})

export const importEmployees = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const result = await employeesService.importRows(req.body, auth.companyId)
  sendSuccess(res, result)
})

export const validateEmployeeAccount = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const employee = await employeesService.validateAccount(
      getRouteParam(req, "id"),
      auth.companyId
    )
    sendSuccess(res, employee)
  }
)

export const validateEmployeeAccounts = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const result = await employeesService.validateAccounts(
      auth.companyId,
      req.body.employeeIds
    )
    sendSuccess(res, result)
  }
)
