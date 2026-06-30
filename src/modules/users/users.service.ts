import { and, eq } from "drizzle-orm"

import { PLATFORM_SESSION_COMPANY } from "../../common/constants/platform"
import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { hashPassword } from "../../common/utils/password"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import { companies, users } from "../../db/schema/index"
import type { CreateUserInput, UpdateUserInput } from "./users.validation"
import { toPublicUser } from "./users.validation"
import { memberInvitesService } from "../members/member-invites.service"
import { notificationService } from "../notifications/notifications.service"

type UserRole = "owner" | "admin" | "manager" | "viewer"

async function getCompany(companyId: string) {
  const company = await findOne(
    db.select().from(companies).where(eq(companies.id, companyId))
  )

  if (!company) throw AppError.notFound("Company not found")

  return {
    id: company.id,
    name: company.name,
    plan: company.plan,
    industry: company.industry ?? undefined,
    legalName: company.legalName ?? undefined,
    status: company.status,
    onboardingStep: company.onboardingStep,
    rejectionReason: company.rejectionReason ?? undefined,
    approvedAt: company.approvedAt ?? undefined,
    chargeId: company.chargeId ?? undefined,
  }
}

export const usersService = {
  async list(companyId: string) {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.companyId, companyId))

    return rows.map((row) => toPublicUser(row))
  },

  async getById(id: string, companyId?: string) {
    const row = companyId
      ? await findOne(
          db
            .select()
            .from(users)
            .where(and(eq(users.id, id), eq(users.companyId, companyId)))
        )
      : await findOne(db.select().from(users).where(eq(users.id, id)))

    if (!row) throw AppError.notFound("User not found")
    return toPublicUser(row)
  },

  async getSessionByUserId(userId: string) {
    const user = await this.getById(userId)
    const company = user.companyId
      ? await getCompany(user.companyId)
      : PLATFORM_SESSION_COMPANY

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        isSystemAdmin: user.isSystemAdmin,
      },
      company,
    }
  },

  async create(input: CreateUserInput, companyId: string) {
    const existing = await findOne(
      db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
    )

    if (existing) {
      throw AppError.duplicate("A user with this email already exists")
    }

    const now = nowIso()
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : null

    const row = {
      id: createId(),
      companyId,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      avatar: input.avatar ?? null,
      role: input.role,
      status: passwordHash ? ("active" as const) : ("invited" as const),
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(users).values(row)
    return toPublicUser(row)
  },

  async update(
    id: string,
    input: UpdateUserInput,
    companyId: string,
    actorRole?: UserRole
  ) {
    const current = await findOne(
      db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.companyId, companyId)))
    )

    if (!current) throw AppError.notFound("User not found")

    if (current.role === "owner" && input.role && input.role !== "owner") {
      throw AppError.forbidden("Cannot change the owner's role")
    }

    if (current.role === "owner" && input.status === "inactive") {
      throw AppError.forbidden("Cannot deactivate the owner")
    }

    if (actorRole && actorRole !== "owner" && current.role === "admin") {
      throw AppError.forbidden("Only the owner can modify admins")
    }

    if (input.email) {
      const duplicate = await findOne(
        db
          .select()
          .from(users)
          .where(eq(users.email, input.email.toLowerCase()))
      )

      if (duplicate && duplicate.id !== id) {
        throw AppError.duplicate("A user with this email already exists")
      }
    }

    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined

    await db
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined
          ? { email: input.email.toLowerCase() }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.avatar !== undefined
          ? { avatar: input.avatar ?? null }
          : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(users.id, id))

    return this.getById(id, companyId)
  },

  async remove(id: string, companyId: string) {
    const current = await findOne(
      db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.companyId, companyId)))
    )

    if (!current) throw AppError.notFound("User not found")
    if (current.role === "owner") {
      throw AppError.forbidden("Cannot remove the owner")
    }

    await db
      .update(users)
      .set({ status: "inactive", updatedAt: nowIso() })
      .where(eq(users.id, id))
  },

  async invite(
    input: {
      name: string
      email: string
      role: Exclude<UserRole, "owner">
    },
    companyId: string,
    invitedBy?: { userId: string; name: string }
  ) {
    const user = await this.create(
      {
        name: input.name,
        email: input.email,
        role: input.role,
      },
      companyId
    )

    const token = await memberInvitesService.createInvite({
      userId: user.id,
      companyId,
      invitedByUserId: invitedBy?.userId,
    })

    const company = await getCompany(companyId)
    const inviteUrl = memberInvitesService.buildInviteUrl(token)

    await notificationService.sendMemberInviteEmail({
      userId: user.id,
      companyId,
      recipientEmail: user.email,
      recipientName: user.name,
      companyName: company.name,
      inviterName: invitedBy?.name ?? "A teammate",
      role: input.role,
      inviteUrl,
    })

    return user
  },

  async addMember(input: CreateUserInput, companyId: string) {
    if (!input.password) {
      throw AppError.validation("Password is required when adding a member directly")
    }

    return this.create(input, companyId)
  },

  async resendInvite(
    id: string,
    companyId: string,
    invitedBy?: { userId: string; name: string }
  ) {
    const user = await findOne(
      db
        .select()
        .from(users)
        .where(and(eq(users.id, id), eq(users.companyId, companyId)))
    )

    if (!user) throw AppError.notFound("User not found")
    if (user.status !== "invited") {
      throw AppError.validation("Only invited members can receive a new invitation")
    }

    const token = await memberInvitesService.createInvite({
      userId: user.id,
      companyId,
      invitedByUserId: invitedBy?.userId,
    })

    const company = await getCompany(companyId)
    const inviteUrl = memberInvitesService.buildInviteUrl(token)

    await notificationService.sendMemberInviteEmail({
      userId: user.id,
      companyId,
      recipientEmail: user.email,
      recipientName: user.name,
      companyName: company.name,
      inviterName: invitedBy?.name ?? "A teammate",
      role: user.role,
      inviteUrl,
    })

    return toPublicUser(user)
  },

  async updateRole(
    id: string,
    role: Exclude<UserRole, "owner">,
    companyId: string,
    actorRole?: UserRole
  ) {
    return this.update(id, { role }, companyId, actorRole)
  },
}