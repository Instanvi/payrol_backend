import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { getRouteParam } from "../../common/utils/route-param"
import { sendCreated, sendNoContent, sendSuccess } from "../../common/utils/response"
import { projectsService } from "./projects.service"

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const status = req.query.status as "active" | "inactive" | undefined
  const items = await projectsService.list(auth.companyId, status)
  sendSuccess(res, { data: items })
})

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const project = await projectsService.getById(
    getRouteParam(req, "id"),
    auth.companyId
  )
  sendSuccess(res, project)
})

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const project = await projectsService.create(req.body, auth.companyId)
  sendCreated(res, project)
})

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const project = await projectsService.update(
    getRouteParam(req, "id"),
    req.body,
    auth.companyId
  )
  sendSuccess(res, project)
})

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  await projectsService.remove(getRouteParam(req, "id"), auth.companyId)
  sendNoContent(res)
})

export const listProjectEmployees = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const employees = await projectsService.listEmployees(
      getRouteParam(req, "id"),
      auth.companyId
    )
    sendSuccess(res, { data: employees })
  }
)

export const setProjectEmployees = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const employees = await projectsService.setEmployees(
      getRouteParam(req, "id"),
      req.body.employeeIds,
      auth.companyId
    )
    sendSuccess(res, { data: employees })
  }
)

export const exportProjectPayroll = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = requireTenantAuth(req)
    const { buffer, filename } = await projectsService.exportPayrollExcel(
      getRouteParam(req, "id"),
      auth.companyId
    )

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.send(buffer)
  }
)
