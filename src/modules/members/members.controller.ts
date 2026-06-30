import type { Request, Response } from "express"

import { asyncHandler } from "../../common/middleware/asyncHandler"
import { listQuerySchema, paginateList } from "../../common/utils/pagination"
import { getRouteParam } from "../../common/utils/route-param"
import {
  sendCreated,
  sendNoContent,
  sendPaginated,
  sendSuccess,
} from "../../common/utils/response"
import { membersServiceWithAuth } from "./members.service"

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const service = membersServiceWithAuth(req)
  const query = listQuerySchema.parse(req.query)
  const items = await service.list()
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

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const service = membersServiceWithAuth(req)
  const member = await service.invite(req.body)
  sendCreated(res, member)
})

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const service = membersServiceWithAuth(req)
  const member = await service.add(req.body)
  sendCreated(res, member)
})

export const resendMemberInvite = asyncHandler(
  async (req: Request, res: Response) => {
    const service = membersServiceWithAuth(req)
    const member = await service.resendInvite(getRouteParam(req, "id"))
    sendSuccess(res, member)
  }
)

export const updateMemberRole = asyncHandler(
  async (req: Request, res: Response) => {
    const service = membersServiceWithAuth(req)
    const member = await service.updateRole(
      getRouteParam(req, "id"),
      req.body.role
    )
    sendSuccess(res, member)
  }
)

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const service = membersServiceWithAuth(req)
  await service.remove(getRouteParam(req, "id"))
  sendNoContent(res)
})
