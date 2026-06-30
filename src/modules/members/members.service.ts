import type { Request } from "express"

import { AppError } from "../../common/errors/AppError"
import { env } from "../../config/env"
import { requireTenantAuth } from "../../common/utils/auth-context"
import { usersService } from "../users/users.service"
import { toMemberShape } from "../users/users.validation"
import type { AddMemberInput, InviteMemberInput } from "./members.validation"

type MemberRole = "owner" | "admin" | "manager" | "viewer"

export const membersService = {
  async list(companyId?: string) {
    const id = companyId ?? getCompanyIdFallback()
    const users = await usersService.list(id)
    return users
      .filter((user) => user.status !== "inactive")
      .map(toMemberShape)
  },

  async getById(id: string, companyId?: string) {
    const cid = companyId ?? getCompanyIdFallback()
    const user = await usersService.getById(id, cid)
    if (user.status === "inactive") {
      throw AppError.notFound("Member not found")
    }
    return toMemberShape(user)
  },

  async invite(
    input: InviteMemberInput,
    companyId?: string,
    invitedBy?: { userId: string; name: string }
  ) {
    const cid = companyId ?? getCompanyIdFallback()
    const user = await usersService.invite(input, cid, invitedBy)
    return toMemberShape(user)
  },

  async add(input: AddMemberInput, companyId?: string) {
    const cid = companyId ?? getCompanyIdFallback()
    const user = await usersService.addMember(input, cid)
    return toMemberShape(user)
  },

  async resendInvite(
    id: string,
    companyId?: string,
    invitedBy?: { userId: string; name: string }
  ) {
    const cid = companyId ?? getCompanyIdFallback()
    const user = await usersService.resendInvite(id, cid, invitedBy)
    return toMemberShape(user)
  },

  async updateRole(
    id: string,
    role: Exclude<MemberRole, "owner">,
    companyId?: string,
    actorRole?: MemberRole
  ) {
    const cid = companyId ?? getCompanyIdFallback()
    const user = await usersService.updateRole(id, role, cid, actorRole)
    return toMemberShape(user)
  },

  async remove(id: string, companyId?: string) {
    const cid = companyId ?? getCompanyIdFallback()
    await usersService.remove(id, cid)
  },
}

function getCompanyIdFallback() {
  return env.DEFAULT_COMPANY_ID
}

async function getInviter(auth: ReturnType<typeof requireTenantAuth>) {
  const user = await usersService.getById(auth.userId)
  return { userId: user.id, name: user.name }
}

export function membersServiceWithAuth(req: Request) {
  const auth = requireTenantAuth(req)

  return {
    list: () => membersService.list(auth.companyId),
    getById: (id: string) => membersService.getById(id, auth.companyId),
    invite: async (input: InviteMemberInput) => {
      const invitedBy = await getInviter(auth)
      return membersService.invite(input, auth.companyId, invitedBy)
    },
    add: (input: AddMemberInput) => membersService.add(input, auth.companyId),
    resendInvite: async (id: string) => {
      const invitedBy = await getInviter(auth)
      return membersService.resendInvite(id, auth.companyId, invitedBy)
    },
    updateRole: (id: string, role: Exclude<MemberRole, "owner">) =>
      membersService.updateRole(
        id,
        role,
        auth.companyId,
        auth.role as MemberRole
      ),
    remove: (id: string) => membersService.remove(id, auth.companyId),
  }
}
