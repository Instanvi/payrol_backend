import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { getAuth, requireTenantAuth } from "../../common/utils/auth-context"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { getRouteParam } from "../../common/utils/route-param"
import {
  sendCreated,
  sendNoContent,
  sendPaginated,
  sendSuccess,
} from "../../common/utils/response"
import { usersService } from "./users.service"

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const query = listQuerySchema.parse(req.query)
  const items = await usersService.list(auth.companyId)
  const result = paginateList(items, query, {
    searchKeys: ["name", "email"],
    filter: (item, params) => {
      if (params.role && item.role !== params.role) return false
      if (params.status && item.status !== params.status) return false
      return true
    },
  })
  sendPaginated(res, result)
})

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const auth = getAuth(req)
  const user = await usersService.getById(auth.userId, auth.companyId ?? undefined)
  sendSuccess(res, user)
})

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const user = await usersService.getById(getRouteParam(req, "id"), auth.companyId)
  sendSuccess(res, user)
})

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const user = await usersService.create(req.body, auth.companyId)
  sendCreated(res, user)
})

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  const user = await usersService.update(
    getRouteParam(req, "id"),
    req.body,
    auth.companyId,
    auth.role as "owner" | "admin" | "manager" | "viewer"
  )
  sendSuccess(res, user)
})

export const removeUser = asyncHandler(async (req: Request, res: Response) => {
  const auth = requireTenantAuth(req)
  await usersService.remove(getRouteParam(req, "id"), auth.companyId)
  sendNoContent(res)
})
